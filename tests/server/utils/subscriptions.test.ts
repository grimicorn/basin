import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import {
  processedStripeEvents,
  subscriptions,
} from "../../../server/db/schema";

const { mockCreateStripeCustomer, mockDeleteStripeCustomer } = vi.hoisted(
  () => ({
    mockCreateStripeCustomer: vi.fn(),
    mockDeleteStripeCustomer: vi.fn(),
  }),
);
vi.mock("../../../server/utils/stripe", () => ({
  createStripeCustomer: mockCreateStripeCustomer,
  deleteStripeCustomer: mockDeleteStripeCustomer,
}));

const mockFindFirst = vi.fn();
const mockFindFirstProcessedEvent = vi.fn();
const mockReturning = vi.fn();
const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
const mockOnConflictDoNothing = vi.fn();
const mockValues = vi.fn((_values: Record<string, unknown>) => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
  onConflictDoNothing: mockOnConflictDoNothing,
}));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.stubGlobal("useDb", () => ({
  query: {
    subscriptions: { findFirst: mockFindFirst },
    processedStripeEvents: { findFirst: mockFindFirstProcessedEvent },
  },
  insert: mockInsert,
}));

import {
  planForStatus,
  getAccountPlan,
  FREE_PLAN,
  getOrCreateStripeCustomerId,
  upsertSubscriptionFromStripe,
} from "../../../server/utils/subscriptions";

describe("planForStatus", () => {
  it("returns 'pro' for trialing", () => {
    expect(planForStatus("trialing")).toBe("pro");
  });

  it("returns 'pro' for active", () => {
    expect(planForStatus("active")).toBe("pro");
  });

  it.each([
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
    "none",
  ])("returns 'free' for %s", (status) => {
    expect(planForStatus(status)).toBe("free");
  });
});

describe("getAccountPlan", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns FREE_PLAN when no subscription row exists", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const plan = await getAccountPlan(1);
    expect(plan).toEqual(FREE_PLAN);
  });

  it("maps the stored subscription row to an AccountPlan", async () => {
    const trialEnd = new Date("2026-01-15");
    const currentPeriodEnd = new Date("2026-02-01");
    mockFindFirst.mockResolvedValue({
      plan: "pro",
      status: "trialing",
      trialEnd,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    });
    const plan = await getAccountPlan(1);
    expect(plan).toEqual({
      plan: "pro",
      status: "trialing",
      trialEnd,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    });
  });
});

describe("getOrCreateStripeCustomerId", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the existing customer ID without creating a new customer", async () => {
    mockFindFirst.mockResolvedValue({ stripeCustomerId: "cus_existing" });
    const customerId = await getOrCreateStripeCustomerId(1, "a@b.com");
    expect(customerId).toBe("cus_existing");
    expect(mockCreateStripeCustomer).not.toHaveBeenCalled();
  });

  it("creates a Stripe customer and persists it when none exists", async () => {
    mockFindFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ stripeCustomerId: "cus_new" });
    mockCreateStripeCustomer.mockResolvedValue({ id: "cus_new" });
    const customerId = await getOrCreateStripeCustomerId(1, "a@b.com");
    expect(customerId).toBe("cus_new");
    expect(mockCreateStripeCustomer).toHaveBeenCalledWith({
      email: "a@b.com",
      userId: 1,
    });
    expect(mockValues).toHaveBeenCalledWith({
      userId: 1,
      stripeCustomerId: "cus_new",
    });
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
    expect(mockDeleteStripeCustomer).not.toHaveBeenCalled();
  });

  it("returns the winning row's customer ID and deletes the orphan on a race", async () => {
    // The insert is ignored (onConflictDoNothing), the re-read returns the
    // winner's customer ID, and the customer we created (the loser) is deleted
    // so it isn't orphaned in Stripe.
    mockFindFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ stripeCustomerId: "cus_winner" });
    mockCreateStripeCustomer.mockResolvedValue({ id: "cus_loser" });
    mockDeleteStripeCustomer.mockResolvedValue(undefined);
    const customerId = await getOrCreateStripeCustomerId(1, "a@b.com");
    expect(customerId).toBe("cus_winner");
    expect(mockDeleteStripeCustomer).toHaveBeenCalledWith("cus_loser");
  });

  it("still returns the winning customer ID if deleting the orphan fails", async () => {
    // Best-effort cleanup: a transient Stripe failure while deleting the
    // orphaned loser customer must not fail the checkout the user is
    // waiting on — the caller already has a valid winning customer ID.
    mockFindFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ stripeCustomerId: "cus_winner" });
    mockCreateStripeCustomer.mockResolvedValue({ id: "cus_loser" });
    mockDeleteStripeCustomer.mockRejectedValue(new Error("Stripe timeout"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const customerId = await getOrCreateStripeCustomerId(1, "a@b.com");
    expect(customerId).toBe("cus_winner");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("upsertSubscriptionFromStripe", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: this event id hasn't been seen before. Individual tests
    // override this to simulate a redelivered/duplicate event.
    mockFindFirstProcessedEvent.mockResolvedValue(undefined);
    // Default: the write's setWhere guard is satisfied (a row came back),
    // i.e. the database agreed the event wasn't stale. Individual tests
    // override this to simulate the database blocking a stale write.
    mockOnConflictDoUpdate.mockImplementation(() => ({
      returning: mockReturning,
    }));
    mockReturning.mockResolvedValue([{ id: 1 }]);
  });

  // Only a minimal fake shape is needed for these tests; cast once here so
  // call sites don't need repeated type assertions.
  function buildSubscription(
    overrides: Record<string, unknown> = {},
  ): Stripe.Subscription {
    return {
      id: "sub_123",
      customer: "cus_123",
      status: "trialing",
      cancel_at_period_end: false,
      trial_end: 1750000000,
      metadata: {},
      items: {
        data: [
          { price: { id: "price_yearly" }, current_period_end: 1755000000 },
        ],
      },
      ...overrides,
    } as unknown as Stripe.Subscription;
  }

  // Wraps a subscription in the Stripe.Event envelope upsertSubscriptionFromStripe
  // now takes, so dedup (event.id) and ordering (event.created) can be tested.
  function buildEvent(
    subscriptionOverrides: Record<string, unknown> = {},
    eventOverrides: Record<string, unknown> = {},
  ): Stripe.Event {
    return {
      id: "evt_123",
      type: "customer.subscription.updated",
      created: 1750000500,
      data: { object: buildSubscription(subscriptionOverrides) },
      ...eventOverrides,
    } as unknown as Stripe.Event;
  }

  it("does nothing when the customer isn't known and metadata has no userId", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await upsertSubscriptionFromStripe(buildEvent());
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("upserts using the userId from the row matched by customer ID", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(buildEvent());
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_yearly",
        plan: "pro",
        status: "trialing",
        cancelAtPeriodEnd: false,
        lastStripeEventAt: new Date(1750000500 * 1000),
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("falls back to the metadata userId when no row matches the customer ID", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await upsertSubscriptionFromStripe(
      buildEvent({ metadata: { userId: "5" } }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5 }),
    );
  });

  it("maps a canceled subscription to plan 'free'", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(buildEvent({ status: "canceled" }));
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", status: "canceled" }),
    );
  });

  it("applies an event for the currently-active subscription", async () => {
    mockFindFirst.mockResolvedValue({
      userId: 9,
      stripeSubscriptionId: "sub_123",
      lastStripeEventAt: null,
    });
    await upsertSubscriptionFromStripe(
      buildEvent({ id: "sub_123", status: "canceled" }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", status: "canceled" }),
    );
  });

  it("converts unix timestamps to Date objects", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(buildEvent());
    const values = mockValues.mock.calls[0][0] as {
      trialEnd: Date;
      currentPeriodEnd: Date;
    };
    expect(values.trialEnd).toEqual(new Date(1750000000 * 1000));
    expect(values.currentPeriodEnd).toEqual(new Date(1755000000 * 1000));
  });

  it("handles a null trial_end", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(buildEvent({ trial_end: null }));
    const values = mockValues.mock.calls[0][0] as { trialEnd: Date | null };
    expect(values.trialEnd).toBeNull();
  });

  it("resolves the object form (not just a string) of subscription.customer", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(
      buildEvent({ customer: { id: "cus_obj" } }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: "cus_obj" }),
    );
  });

  it("falls back to the legacy top-level current_period_end when the item lacks it", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(
      buildEvent({
        current_period_end: 1760000000,
        items: { data: [{ price: { id: "price_yearly" } }] },
      }),
    );
    const values = mockValues.mock.calls[0][0] as { currentPeriodEnd: Date };
    expect(values.currentPeriodEnd).toEqual(new Date(1760000000 * 1000));
  });

  describe("duplicate delivery (dedup on event id)", () => {
    it("applies a first-seen event and records it as processed", async () => {
      mockFindFirst.mockResolvedValue({ userId: 9 });
      await upsertSubscriptionFromStripe(buildEvent());
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalledWith(processedStripeEvents);
      expect(mockValues).toHaveBeenCalledWith({
        stripeEventId: "evt_123",
        eventType: "customer.subscription.updated",
      });
      expect(mockOnConflictDoNothing).toHaveBeenCalledWith({
        target: processedStripeEvents.stripeEventId,
      });
    });

    it("is a no-op the second time the same event id is delivered", async () => {
      mockFindFirst.mockResolvedValue({ userId: 9 });

      // First delivery: not yet processed, applies normally.
      mockFindFirstProcessedEvent.mockResolvedValueOnce(undefined);
      await upsertSubscriptionFromStripe(buildEvent());
      expect(mockInsert).toHaveBeenCalledWith(subscriptions);

      // Second delivery of the identical event id: already recorded as
      // processed, so the subscription table must not be written to again.
      mockInsert.mockClear();
      mockFindFirstProcessedEvent.mockResolvedValueOnce({ id: 1 });
      await upsertSubscriptionFromStripe(buildEvent());
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("out-of-order delivery (event timestamp ordering)", () => {
    it("does not overwrite state written by a newer event when an older one for the same subscription arrives later", async () => {
      // The stored row already reflects a newer event (e.g. "active" at
      // t=2_000_000); a redelivered/delayed older event for the same
      // subscription (e.g. a stale "past_due" at t=1_000_000) must be dropped.
      mockFindFirst.mockResolvedValue({
        userId: 9,
        stripeSubscriptionId: "sub_123",
        lastStripeEventAt: new Date(2_000_000 * 1000),
      });
      await upsertSubscriptionFromStripe(
        buildEvent(
          { id: "sub_123", status: "past_due" },
          { id: "evt_old", created: 1_000_000 },
        ),
      );
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("applies a genuinely newer event for the same subscription", async () => {
      mockFindFirst.mockResolvedValue({
        userId: 9,
        stripeSubscriptionId: "sub_123",
        lastStripeEventAt: new Date(1_000_000 * 1000),
      });
      await upsertSubscriptionFromStripe(
        buildEvent(
          { id: "sub_123", status: "active" },
          { id: "evt_new", created: 2_000_000 },
        ),
      );
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          lastStripeEventAt: new Date(2_000_000 * 1000),
        }),
      );
    });

    it("applies a distinct event with the exact same timestamp as the stored one", async () => {
      // Ties are NOT stale: Stripe can fire multiple distinct events for the
      // same subscription within the same one-second `created` value (e.g.
      // "updated" immediately followed by "deleted" on cancellation).
      // Rejecting ties would get the row stuck on the first of the pair
      // forever. Exact redelivery of the *same* event id is a separate
      // concern already handled by the processed-events dedup table.
      mockFindFirst.mockResolvedValue({
        userId: 9,
        stripeSubscriptionId: "sub_123",
        lastStripeEventAt: new Date(1_000_000 * 1000),
      });
      await upsertSubscriptionFromStripe(
        buildEvent(
          { id: "sub_123", status: "canceled" },
          { id: "evt_tie", created: 1_000_000 },
        ),
      );
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: "canceled" }),
      );
    });

    it("applies a newer event for a different (resubscribed) subscription id", async () => {
      // User resubscribed: a genuinely newer event for a *different*
      // subscription id must still be applied — staleness is judged purely
      // by timestamp, not by whether the subscription id changed.
      mockFindFirst.mockResolvedValue({
        userId: 9,
        stripeSubscriptionId: "sub_old",
        lastStripeEventAt: new Date(1_000_000 * 1000),
      });
      await upsertSubscriptionFromStripe(
        buildEvent(
          { id: "sub_new", status: "active" },
          { id: "evt_resubscribe", created: 2_000_000 },
        ),
      );
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: "sub_new",
          plan: "pro",
          status: "active",
        }),
      );
    });

    it("drops a replayed event for an old subscription id the row has since moved past", async () => {
      mockFindFirst.mockResolvedValue({
        userId: 9,
        stripeSubscriptionId: "sub_new",
        lastStripeEventAt: new Date(2_000_000 * 1000),
      });
      await upsertSubscriptionFromStripe(
        buildEvent(
          { id: "sub_123", status: "canceled" },
          { id: "evt_old_replay", created: 1_000_000 },
        ),
      );
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("does not mark the event processed when the database blocks a stale write that slipped past the in-memory pre-filter", async () => {
      // Simulates two deliveries racing past the in-memory isStaleEvent
      // check with the same stale `existing` read (e.g. a concurrent worker
      // already applied a newer event between the read and the write here).
      // setWhere is the authoritative guard: Postgres returns no row, and
      // that must stop the event from being recorded as processed.
      mockFindFirst.mockResolvedValue({
        userId: 9,
        stripeSubscriptionId: "sub_123",
        lastStripeEventAt: null,
      });
      mockReturning.mockResolvedValueOnce([]);
      await upsertSubscriptionFromStripe(buildEvent());
      expect(mockInsert).toHaveBeenCalledWith(subscriptions);
      expect(mockInsert).not.toHaveBeenCalledWith(processedStripeEvents);
    });
  });
});
