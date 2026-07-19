import { and, eq } from "drizzle-orm";
import { feeds, integrations } from "../../server/db/schema";
import { SYNC_STATUS } from "../../server/utils/syncStatus";
import { createDb } from "./db";

// Maps a feed's sourceType to the integration provider it depends on. RSS
// and podcast feeds have no backing integration, so they map to null and
// only the feed's own sync status is tracked for them.
const SOURCE_TYPE_PROVIDER: Record<string, string | undefined> = {
  youtube: "youtube",
  bluesky: "bluesky",
};

export function providerForSourceType(sourceType: string): string | null {
  return SOURCE_TYPE_PROVIDER[sourceType] ?? null;
}

async function recordFeedSyncFailure(
  feedId: number,
  message: string,
): Promise<void> {
  const db = createDb();
  await db
    .update(feeds)
    .set({
      syncStatus: SYNC_STATUS.ERROR,
      syncError: message,
      syncFailedAt: new Date(),
    })
    .where(eq(feeds.id, feedId));
}

async function recordFeedSyncSuccess(
  feedId: number,
  syncedAt: Date,
): Promise<void> {
  const db = createDb();
  await db
    .update(feeds)
    .set({
      lastFetched: syncedAt,
      syncStatus: SYNC_STATUS.OK,
      syncError: null,
      syncFailedAt: null,
    })
    .where(eq(feeds.id, feedId));
}

async function recordIntegrationSyncFailure(
  userId: number,
  provider: string,
  message: string,
): Promise<void> {
  const db = createDb();
  await db
    .update(integrations)
    .set({
      syncStatus: SYNC_STATUS.ERROR,
      syncError: message,
      syncFailedAt: new Date(),
    })
    .where(
      and(eq(integrations.userId, userId), eq(integrations.provider, provider)),
    );
}

async function recordIntegrationSyncSuccess(
  userId: number,
  provider: string,
): Promise<void> {
  const db = createDb();
  await db
    .update(integrations)
    .set({ syncStatus: SYNC_STATUS.OK, syncError: null, syncFailedAt: null })
    .where(
      and(eq(integrations.userId, userId), eq(integrations.provider, provider)),
    );
}

// Persists a permanent (ErrorDoNotRetry) sync failure on the feed, and — when
// the source type is backed by a third-party integration — on that
// integration too, so both SettingsFeeds and SettingsConnections can surface
// a "needs attention" indicator. Looking the integration up by (userId,
// provider) rather than an id means this still works even when the caller
// never loaded the integration row (e.g. "no integration found" failures).
export async function persistPermanentSyncFailure(
  userId: number,
  feedId: number,
  sourceType: string,
  message: string,
): Promise<void> {
  await recordFeedSyncFailure(feedId, message);

  const provider = providerForSourceType(sourceType);
  if (!provider) {
    return;
  }

  await recordIntegrationSyncFailure(userId, provider, message);
}

// Marks a feed sync as successful and clears any previously-recorded failure
// on the feed and (when applicable) its backing integration.
export async function persistSyncSuccess(
  userId: number,
  feedId: number,
  sourceType: string,
  syncedAt: Date,
): Promise<void> {
  await recordFeedSyncSuccess(feedId, syncedAt);

  const provider = providerForSourceType(sourceType);
  if (!provider) {
    return;
  }

  await recordIntegrationSyncSuccess(userId, provider);
}
