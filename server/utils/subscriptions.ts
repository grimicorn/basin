// Owns reads/writes to the `subscriptions` table and translates Stripe
// subscription objects into our own plan/status representation. Keeps the
// Stripe SDK calls (server/utils/stripe.ts) separate from persistence.
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { subscriptions } from "../db/schema";
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
  if (!subscription) return FREE_PLAN;

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
  if (existing) return existing.stripeCustomerId;

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
  if (winningCustomerId !== customer.id) {
    await deleteStripeCustomer(customer.id);
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
  if (!metadataUserId) return null;
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
  const item = subscription.items.data[0];
  const legacyPeriodEnd = (
    subscription as unknown as { current_period_end?: number }
  ).current_period_end;
  return toDate(item?.current_period_end ?? legacyPeriodEnd);
}

// An event for a subscription that is no longer the row's active one (e.g. an
// out-of-order event for a subscription the user already replaced) must not
// overwrite the current record. Once the stored subscription is no longer
// "pro" (canceled/expired), a different subscription id is a genuine
// resubscribe and is allowed through.
function isStaleEvent(
  existing: { stripeSubscriptionId: string | null; plan: string } | undefined,
  subscription: Stripe.Subscription,
): boolean {
  if (!existing?.stripeSubscriptionId) return false;
  if (existing.stripeSubscriptionId === subscription.id) return false;
  return existing.plan === "pro";
}

// Called from the Stripe webhook for customer.subscription.created/updated/deleted.
// Matches the event to a user via the stored Stripe customer ID (set when the
// checkout session's customer was created), falling back to the userId we embed
// in the subscription metadata at checkout time. If neither resolves, the event
// can't be attributed to a known user and is dropped.
//
// Ordering note: Stripe does not guarantee webhook delivery order. Writes are
// last-write-wins per subscription; the isStaleEvent guard prevents an
// out-of-order event for a subscription the user already replaced from
// overwriting the currently-active one. We do not track a full event version
// beyond that.
export async function upsertSubscriptionFromStripe(
  subscription: Stripe.Subscription,
): Promise<void> {
  const db = useDb();
  const stripeCustomerId = customerIdOf(subscription);

  const existingByCustomer = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, stripeCustomerId),
  });

  const userId =
    existingByCustomer?.userId ?? resolveUserIdFromMetadata(subscription);
  if (!userId) return;

  // Resolve the row we write to by userId (the stable owner key) so the
  // metadata-fallback path updates an existing row rather than colliding on
  // the user_id unique constraint.
  const existing =
    existingByCustomer ??
    (await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    }));

  if (isStaleEvent(existing, subscription)) return;

  const item = subscription.items.data[0];
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
    updatedAt: new Date(),
  };

  await db.insert(subscriptions).values(values).onConflictDoUpdate({
    target: subscriptions.userId,
    set: values,
  });
}
