// Enforces the Free plan's cap on *adding* new sources that the pricing page
// promises (app/pages/pricing.vue): Free accounts are limited to a fixed
// number of sources, any paid plan is unlimited. Isolated here so both
// feed-add entry points — POST /api/feeds and the OPML import route, which both
// funnel through createFeedForUser — share one plan/count check that can be
// unit-tested on its own.
//
// The complementary Pro→Free downgrade path (pausing sources already over the
// cap, which pricing.vue promises) lives in server/utils/feedPause.ts; both
// reuse FREE_PLAN_FEED_LIMIT from planLimits.ts.
import { count, eq } from "drizzle-orm";
import { feeds } from "../db/schema";
import { FREE_PLAN_FEED_LIMIT } from "./planLimits";
import { getAccountPlan } from "./subscriptions";

// Re-exported so existing importers of the cap keep working now that the
// constant lives in its own leaf module (see planLimits.ts for why).
export { FREE_PLAN_FEED_LIMIT };

async function countUserFeeds(userId: number): Promise<number> {
  const [row] = await useDb()
    .select({ value: count() })
    .from(feeds)
    .where(eq(feeds.userId, userId));
  // Fail closed: a missing aggregate row means we can't prove the user is
  // under the cap, so refuse rather than default to 0 and wave them through.
  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: "Could not determine current feed count",
    });
  }
  return row.value;
}

async function userAlreadyHasFeed(
  userId: number,
  url: string,
): Promise<boolean> {
  const existing = await useDb().query.feeds.findFirst({
    where: (feed, { and, eq: equals }) =>
      and(equals(feed.userId, userId), equals(feed.url, url)),
  });
  return Boolean(existing);
}

// Throws a 403 when a Free account tries to add a *new* source beyond the cap.
// Re-adding a URL the user already follows is an update (the add path upserts
// on user+url), not a new source, so it is never blocked. Only the Free plan
// is capped — any paid plan is unlimited and skips the count entirely.
//
// Best-effort under concurrency: the count and the eventual insert aren't one
// transaction (neon-http is stateless, no interactive transaction), so two
// simultaneous single-adds at exactly the limit could both pass and land the
// account one over. The OPML import path is sequential (see import.post.ts),
// so a single import can't stampede past the cap on its own; concurrent
// requests (two imports, or an import racing a single add) can still overshoot.
// A hard, race-proof guarantee would need a DB-level trigger/constraint;
// that's out of scope here.
export async function assertWithinFeedLimit(
  userId: number,
  url: string,
): Promise<void> {
  const { plan } = await getAccountPlan(userId);
  if (plan !== "free") {
    return;
  }

  const alreadySubscribed = await userAlreadyHasFeed(userId, url);
  if (alreadySubscribed) {
    return;
  }

  const currentCount = await countUserFeeds(userId);
  if (currentCount < FREE_PLAN_FEED_LIMIT) {
    return;
  }

  throw createError({
    statusCode: 403,
    statusMessage: `Free plan is limited to ${FREE_PLAN_FEED_LIMIT} sources; upgrade to Pro for unlimited sources`,
  });
}
