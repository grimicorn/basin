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

function isWithinDebounceWindow(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return false;
  return Date.now() - lastSyncedAt.getTime() < DEBOUNCE_WINDOW_MS;
}

async function loadFeed(
  db: SyncFeedDb,
  feedId: number,
  userId: number,
): Promise<typeof feeds.$inferSelect | undefined> {
  return db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });
}

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

async function markFeedSynced(db: SyncFeedDb, feedId: number): Promise<void> {
  await db
    .update(feeds)
    .set({ lastSyncedAt: new Date(), lastFetched: new Date() })
    .where(eq(feeds.id, feedId));
}

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
