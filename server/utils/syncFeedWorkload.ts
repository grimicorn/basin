import { and, eq } from "drizzle-orm";
import { feeds, feedItems } from "../db/schema";
import type { useDb } from "../db/index";
import { fetchRssItemsForFeed } from "./rssAdapter";

// How recently a feed must have synced before we skip it to prevent spam.
const DEBOUNCE_WINDOW_MS = 60_000; // 1 minute

export type SyncFeedPayload = {
  userId: number;
  feedId: number;
  sourceType: string;
  mode: "scheduled" | "on-demand";
};

export type SyncFeedDb = ReturnType<typeof useDb>;

type SyncResult = {
  skipped: boolean;
  reason?: string;
  upsertedCount?: number;
};

/**
 * Checks if a sync operation is within the debounce window.
 *
 * @param lastSyncedAt - The timestamp of the last sync. If `null`, the feed has never been synced.
 * @returns `true` if the last sync occurred within the debounce window, `false` otherwise.
 */
function isWithinDebounceWindow(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return false;
  return Date.now() - lastSyncedAt.getTime() < DEBOUNCE_WINDOW_MS;
}

/**
 * Retrieves a feed by ID, verifying it belongs to the user.
 *
 * @returns The feed record if it exists and belongs to the user, otherwise `undefined`.
 */
async function loadFeed(
  db: SyncFeedDb,
  feedId: number,
  userId: number,
): Promise<typeof feeds.$inferSelect | undefined> {
  return db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });
}

/**
 * Inserts feed items into the database, ignoring duplicates based on feed ID and GUID.
 *
 * @returns The number of items that were successfully inserted.
 */
async function upsertFeedItems(
  db: SyncFeedDb,
  items: {
    feedId: number;
    guid: string;
    title: string;
    url: string | null;
    author: string | null;
    imageUrl: string | null;
    content: string | null;
    publishedAt: Date | null;
    savedAt: Date;
  }[],
): Promise<number> {
  if (items.length === 0) return 0;

  const result = await db
    .insert(feedItems)
    .values(items)
    .onConflictDoNothing({ target: [feedItems.feedId, feedItems.guid] })
    .returning({ id: feedItems.id });

  return result.length;
}

/**
 * Marks a feed as synced by recording the current timestamp.
 *
 * @param feedId - The ID of the feed to mark as synced
 */
async function markFeedSynced(db: SyncFeedDb, feedId: number): Promise<void> {
  await db
    .update(feeds)
    .set({ lastSyncedAt: new Date(), lastFetched: new Date() })
    .where(eq(feeds.id, feedId));
}

/**
 * Fetches RSS items for a feed and upserts them into the database.
 *
 * @returns The number of items that were upserted.
 */
async function syncRssFeed(
  db: SyncFeedDb,
  feed: typeof feeds.$inferSelect,
): Promise<number> {
  const { items } = await fetchRssItemsForFeed(feed.url, feed.id);
  return upsertFeedItems(db, items);
}

const sourceHandlers: Record<
  string,
  (_db: SyncFeedDb, _feed: typeof feeds.$inferSelect) => Promise<number>
> = {
  rss: syncRssFeed,
  podcast: syncRssFeed,
};

/**
 * Fetches and syncs items for a user's feed from its configured source.
 *
 * @param payload - The sync request containing user ID, feed ID, source type, and mode
 * @returns A result object. If skipped (missing feed, debounced, or unknown source type),
 *          `skipped: true` with a `reason`. If successful, `skipped: false` with `upsertedCount`.
 */
export async function syncFeed(
  db: SyncFeedDb,
  payload: SyncFeedPayload,
): Promise<SyncResult> {
  const feed = await loadFeed(db, payload.feedId, payload.userId);

  if (!feed) {
    return {
      skipped: true,
      reason: "feed not found or does not belong to user",
    };
  }

  if (isWithinDebounceWindow(feed.lastSyncedAt)) {
    console.log(
      JSON.stringify({
        event: "sync_feed_debounced",
        feedId: feed.id,
        lastSyncedAt: feed.lastSyncedAt,
      }),
    );
    return { skipped: true, reason: "debounced — synced too recently" };
  }

  const handler = sourceHandlers[payload.sourceType];

  if (!handler) {
    return {
      skipped: true,
      reason: `no handler for sourceType: ${payload.sourceType}`,
    };
  }

  console.log(
    JSON.stringify({
      event: "sync_feed_start",
      feedId: feed.id,
      sourceType: payload.sourceType,
      mode: payload.mode,
    }),
  );

  const upsertedCount = await handler(db, feed);
  await markFeedSynced(db, feed.id);

  console.log(
    JSON.stringify({
      event: "sync_feed_complete",
      feedId: feed.id,
      upsertedCount,
    }),
  );

  return { skipped: false, upsertedCount };
}
