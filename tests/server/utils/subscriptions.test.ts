import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

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
const mockOnConflictDoUpdate = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockValues = vi.fn((_values: Record<string, unknown>) => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
  onConflictDoNothing: mockOnConflictDoNothing,
}));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.stubGlobal("useDb", () => ({
  query: { subscriptions: { findFirst: mockFindFirst } },
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
    const customerId = await getOrCreateStripeCustomerId(1, "a@b.com");
    expect(customerId).toBe("cus_winner");
    expect(mockDeleteStripeCustomer).toHaveBeenCalledWith("cus_loser");
  });
});

describe("upsertSubscriptionFromStripe", () => {
  beforeEach(() => vi.resetAllMocks());

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

  it("does nothing when the customer isn't known and metadata has no userId", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await upsertSubscriptionFromStripe(buildSubscription());
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("upserts using the userId from the row matched by customer ID", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(buildSubscription());
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_yearly",
        plan: "pro",
        status: "trialing",
        cancelAtPeriodEnd: false,
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("falls back to the metadata userId when no row matches the customer ID", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await upsertSubscriptionFromStripe(
      buildSubscription({ metadata: { userId: "5" } }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5 }),
    );
  });

  it("maps a canceled subscription to plan 'free'", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(
      buildSubscription({ status: "canceled" }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", status: "canceled" }),
    );
  });

  it("ignores a stale event for a subscription the active row has replaced", async () => {
    // Row already points at the active sub_new; an out-of-order event for the
    // old sub_123 must not overwrite it.
    mockFindFirst.mockResolvedValue({
      userId: 9,
      stripeSubscriptionId: "sub_new",
      plan: "pro",
    });
    await upsertSubscriptionFromStripe(
      buildSubscription({ id: "sub_123", status: "canceled" }),
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("applies an event for the currently-active subscription", async () => {
    mockFindFirst.mockResolvedValue({
      userId: 9,
      stripeSubscriptionId: "sub_123",
      plan: "pro",
    });
    await upsertSubscriptionFromStripe(
      buildSubscription({ id: "sub_123", status: "canceled" }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", status: "canceled" }),
    );
  });

  it("applies a new subscription once the stored one is no longer active", async () => {
    // User resubscribed: stored row is already free, so a different, active
    // subscription id is a genuine new subscription and must be applied.
    mockFindFirst.mockResolvedValue({
      userId: 9,
      stripeSubscriptionId: "sub_old",
      plan: "free",
    });
    await upsertSubscriptionFromStripe(
      buildSubscription({ id: "sub_new", status: "active" }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: "sub_new",
        plan: "pro",
        status: "active",
      }),
    );
  });

  it("converts unix timestamps to Date objects", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(buildSubscription());
    const values = mockValues.mock.calls[0][0] as {
      trialEnd: Date;
      currentPeriodEnd: Date;
    };
    expect(values.trialEnd).toEqual(new Date(1750000000 * 1000));
    expect(values.currentPeriodEnd).toEqual(new Date(1755000000 * 1000));
  });

  it("handles a null trial_end", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(buildSubscription({ trial_end: null }));
    const values = mockValues.mock.calls[0][0] as { trialEnd: Date | null };
    expect(values.trialEnd).toBeNull();
  });

  it("resolves the object form (not just a string) of subscription.customer", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(
      buildSubscription({ customer: { id: "cus_obj" } }),
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: "cus_obj" }),
    );
  });

  it("falls back to the legacy top-level current_period_end when the item lacks it", async () => {
    mockFindFirst.mockResolvedValue({ userId: 9 });
    await upsertSubscriptionFromStripe(
      buildSubscription({
        current_period_end: 1760000000,
        items: { data: [{ price: { id: "price_yearly" } }] },
      }),
    );
    const values = mockValues.mock.calls[0][0] as { currentPeriodEnd: Date };
    expect(values.currentPeriodEnd).toEqual(new Date(1760000000 * 1000));
  });
});
