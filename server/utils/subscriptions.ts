// Owns reads/writes to the `subscriptions` table and translates Stripe
// subscription objects into our own plan/status representation. Keeps the
// Stripe SDK calls (server/utils/stripe.ts) separate from persistence.
import { eq, isNull, lte, or } from "drizzle-orm";
import type Stripe from "stripe";
import { processedStripeEvents, subscriptions } from "../db/schema";
import { createStripeCustomer, deleteStripeCustomer } from "./stripe";

export type PlanName = "free" | "pro";

// Statuses that grant Pro access. Everything else (past_due, canceled,
// unpaid, incomplete, incomplete_expired, paused) falls back to "free".
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);

export function planForStatus(status: string): PlanName {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status) ? "pro" : "free";
}

export interface AccountPlan {
  plan: PlanName;
  status: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export const FREE_PLAN: AccountPlan = {
  plan: "free",
  status: "none",
  trialEnd: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

export async function getAccountPlan(userId: number): Promise<AccountPlan> {
  const db = useDb();
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!subscription) {
    // Return a copy — FREE_PLAN is a shared module-level object and callers
    // must not be able to mutate it for other requests.
    return { ...FREE_PLAN };
  }

  return {
    plan: subscription.plan as PlanName,
    status: subscription.status,
    trialEnd: subscription.trialEnd,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export async function getOrCreateStripeCustomerId(
  userId: number,
  email: string | null,
): Promise<string> {
  const db = useDb();
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (existing) {
    return existing.stripeCustomerId;
  }

  // check-then-act is not atomic: two near-simultaneous first checkouts could
  // both reach here. onConflictDoNothing lets the loser's insert be ignored,
  // then we re-read so both requests return the winning customer ID (rather
  // than 500 on the unique constraint or return a mismatched customer).
  const customer = await createStripeCustomer({ email, userId });
  await db
    .insert(subscriptions)
    .values({ userId, stripeCustomerId: customer.id })
    .onConflictDoNothing({ target: subscriptions.userId });

  const persisted = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  const winningCustomerId = persisted?.stripeCustomerId ?? customer.id;

  // If we lost the race our freshly-created customer is now orphaned in Stripe
  // (no row references it); delete it so it can't accumulate a subscription.
  // This is best-effort cleanup: the caller already has a valid
  // winningCustomerId, so a transient Stripe failure here must not fail the
  // checkout the user is waiting on. Log it loudly instead of swallowing it
  // silently so the orphaned customer can be cleaned up manually.
  if (winningCustomerId !== customer.id) {
    await deleteStripeCustomer(customer.id).catch((cleanupError) => {
      console.error(
        `Failed to delete orphaned Stripe customer ${customer.id}:`,
        cleanupError,
      );
    });
  }
  return winningCustomerId;
}

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function resolveUserIdFromMetadata(
  subscription: Stripe.Subscription,
): number | null {
  const metadataUserId = subscription.metadata?.userId;
  if (!metadataUserId) {
    return null;
  }
  const parsed = Number(metadataUserId);
  return Number.isInteger(parsed) ? parsed : null;
}

function toDate(unixSeconds: number | null | undefined): Date | null {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

// Reads current_period_end from the subscription item (where it lives in the
// pinned API version) and falls back to the legacy top-level field so an older
// account default doesn't silently persist a null period end.
function currentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items?.data?.[0];
  const legacyPeriodEnd = (
    subscription as unknown as { current_period_end?: number }
  ).current_period_end;
  return toDate(item?.current_period_end ?? legacyPeriodEnd);
}

// An event is stale — and must not overwrite the stored row — when its
// Stripe `created` timestamp is strictly older than the last event already
// applied to this row. lastStripeEventAt is written alongside every other
// field on every successful write (see `values` below), so it always
// reflects the created time of whichever event most recently won,
// regardless of which Stripe subscription id that event was for. That makes
// a plain timestamp comparison sufficient to catch both an out-of-order
// update for the *same* subscription (e.g. a stale "past_due" redelivered
// after a newer "active" already synced) and a replayed event for a
// subscription the user has since replaced (a genuine resubscribe's events
// are, in practice, always newer than whatever was last recorded).
//
// A tie (equal timestamps) is NOT stale: Stripe can emit multiple distinct
// events for the same subscription within the same one-second `created`
// value (e.g. `updated` immediately followed by `deleted` on cancellation),
// and rejecting same-timestamp events would let the row get stuck on the
// first of the pair forever. Exact redelivery of the *same* event is a
// separate concern already handled by wasEventAlreadyProcessed.
//
// This check is only a cheap in-memory pre-filter — the authoritative,
// race-safe guarantee is the `setWhere` clause on the write below, which
// Postgres evaluates atomically against the row's current state.
function isStaleEvent(
  existingLastStripeEventAt: Date | null | undefined,
  eventCreatedAt: Date,
): boolean {
  if (!existingLastStripeEventAt) {
    return false;
  }
  return eventCreatedAt < existingLastStripeEventAt;
}

async function wasEventAlreadyProcessed(
  db: ReturnType<typeof useDb>,
  stripeEventId: string,
): Promise<boolean> {
  const processedEvent = await db.query.processedStripeEvents.findFirst({
    where: eq(processedStripeEvents.stripeEventId, stripeEventId),
  });
  return Boolean(processedEvent);
}

// Records that an event was applied, so a redelivery of the same event id is
// a no-op instead of being reapplied. Always called *after* the subscription
// write below has already succeeded — never before — so a crash between the
// two can only leave an event applied-but-unmarked (safe: a redelivery just
// reapplies the same, idempotent write) and never marked-but-unapplied (which
// would silently drop a real update forever). onConflictDoNothing makes the
// insert itself race-safe if two deliveries of the same event are in flight
// concurrently.
async function markEventProcessed(
  db: ReturnType<typeof useDb>,
  stripeEventId: string,
  eventType: string,
): Promise<void> {
  await db
    .insert(processedStripeEvents)
    .values({ stripeEventId, eventType })
    .onConflictDoNothing({ target: processedStripeEvents.stripeEventId });
}

// Called from the Stripe webhook for customer.subscription.created/updated/deleted.
// Matches the event to a user via the stored Stripe customer ID (set when the
// checkout session's customer was created), falling back to the userId we embed
// in the subscription metadata at checkout time. If neither resolves, the event
// can't be attributed to a known user and is dropped.
//
// Duplicate delivery: Stripe explicitly documents that a webhook event may be
// delivered more than once. wasEventAlreadyProcessed short-circuits a
// redelivery of an event we already fully applied.
//
// Out-of-order delivery: dedup alone doesn't fix this — a *different*, older
// event can still arrive after a newer one. isStaleEvent pre-filters that in
// memory, and the write's `setWhere` enforces it atomically against
// concurrent/racing deliveries (see both comments above and below).
export async function upsertSubscriptionFromStripe(
  event: Stripe.Event,
): Promise<void> {
  const db = useDb();

  if (await wasEventAlreadyProcessed(db, event.id)) {
    return;
  }

  const subscription = event.data.object as Stripe.Subscription;
  const stripeCustomerId = customerIdOf(subscription);

  const existingByCustomer = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, stripeCustomerId),
  });

  const userId =
    existingByCustomer?.userId ?? resolveUserIdFromMetadata(subscription);
  if (!userId) {
    return;
  }

  // Resolve the row we write to by userId (the stable owner key) so the
  // metadata-fallback path updates an existing row rather than colliding on
  // the user_id unique constraint.
  const existing =
    existingByCustomer ??
    (await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    }));

  const eventCreatedAt = new Date(event.created * 1000);
  if (isStaleEvent(existing?.lastStripeEventAt, eventCreatedAt)) {
    return;
  }

  const item = subscription.items?.data?.[0];
  const values = {
    userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item?.price.id ?? null,
    plan: planForStatus(subscription.status),
    status: subscription.status,
    currentPeriodEnd: currentPeriodEnd(subscription),
    trialEnd: toDate(subscription.trial_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    lastStripeEventAt: eventCreatedAt,
    updatedAt: new Date(),
  };

  // The in-memory isStaleEvent check above is only a pre-filter — two
  // concurrent/racing deliveries could both read the row before either
  // writes. `setWhere` makes the actual ordering guarantee atomic: Postgres
  // only applies the update if the row's stored lastStripeEventAt is still
  // older than (or equal to, to allow same-second distinct events) this
  // event's timestamp, so the older of two racing writes can never win.
  const written = await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: values,
      setWhere: or(
        isNull(subscriptions.lastStripeEventAt),
        lte(subscriptions.lastStripeEventAt, eventCreatedAt),
      ),
    })
    .returning({ id: subscriptions.id });

  // `returning` comes back empty when setWhere blocked the update (the DB
  // decided the event was stale after all) — that event was correctly not
  // applied, so it's left unmarked in processedStripeEvents, same as the
  // no-known-userId branch above.
  if (written.length === 0) {
    return;
  }

  // Only recorded once the write above has actually succeeded — see
  // markEventProcessed's comment for why this ordering matters.
  await markEventProcessed(db, event.id, event.type);
}
