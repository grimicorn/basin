import {
  asyncWorkloadFn,
  ErrorDoNotRetry,
  ErrorRetryAfterDelay,
} from "@netlify/async-workloads";
import type { AsyncWorkloadConfig } from "@netlify/async-workloads";
import { eq, and } from "drizzle-orm";
import { feeds, feedItems } from "../../server/db/schema";
import { parseRssFeed } from "../../server/utils/rssAdapter";
import { createDb } from "./db";
import { SYNC_FEED_EVENT_NAME, DEBOUNCE_WINDOW_MS } from "./types";
import type { SyncFeedEvent } from "./types";

// Supported source types — expand as new adapters are added.
const SUPPORTED_SOURCE_TYPES = new Set(["rss", "podcast"]);

async function fetchFeedRecord(feedId: number, userId: number) {
  const db = createDb();
  return db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
    columns: {
      id: true,
      url: true,
      source: true,
      lastFetched: true,
    },
  });
}

function isWithinDebounceWindow(lastFetched: Date | null): boolean {
  if (!lastFetched) {
    return false;
  }

  return Date.now() - lastFetched.getTime() < DEBOUNCE_WINDOW_MS;
}

async function upsertFeedItems(
  feedId: number,
  items: Awaited<ReturnType<typeof parseRssFeed>>,
): Promise<number> {
  if (items.length === 0) {
    return 0;
  }

  const db = createDb();
  const result = await db
    .insert(feedItems)
    .values(items)
    .onConflictDoNothing({ target: [feedItems.feedId, feedItems.guid] })
    .returning({ id: feedItems.id });

  return result.length;
}

async function markFeedSynced(feedId: number): Promise<void> {
  const db = createDb();
  await db
    .update(feeds)
    .set({ lastFetched: new Date() })
    .where(eq(feeds.id, feedId));
}

async function syncRssFeed(feedId: number, feedUrl: string): Promise<number> {
  const items = await parseRssFeed(feedUrl, feedId);
  return upsertFeedItems(feedId, items);
}

export default asyncWorkloadFn<SyncFeedEvent>(async (event) => {
  const { userId, feedId, sourceType, mode } = event.eventData;

  if (!SUPPORTED_SOURCE_TYPES.has(sourceType)) {
    throw new ErrorDoNotRetry(
      `Unsupported sourceType: ${sourceType}. No adapter available.`,
    );
  }

  const feed = await fetchFeedRecord(feedId, userId);

  if (!feed) {
    throw new ErrorDoNotRetry(
      `Feed ${feedId} not found or does not belong to user ${userId}.`,
    );
  }

  if (feed.source !== sourceType) {
    throw new ErrorDoNotRetry(
      `Source mismatch for feed ${feedId}: event=${sourceType}, db=${feed.source}.`,
    );
  }

  if (mode === "scheduled" && isWithinDebounceWindow(feed.lastFetched)) {
    console.log(
      JSON.stringify({
        event: "sync-feed.debounced",
        feedId,
        userId,
        lastFetched: feed.lastFetched,
      }),
    );
    return;
  }

  console.log(
    JSON.stringify({
      event: "sync-feed.start",
      feedId,
      userId,
      sourceType,
      mode,
      attempt: event.attempt,
    }),
  );

  let itemsSynced: number;
  try {
    itemsSynced = await syncRssFeed(feedId, feed.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        event: "sync-feed.error",
        feedId,
        userId,
        attempt: event.attempt,
        error: message,
      }),
    );

    if (event.attempt >= 4) {
      throw new ErrorDoNotRetry(
        `Feed ${feedId} sync failed after ${event.attempt} attempts: ${message}`,
      );
    }

    throw new ErrorRetryAfterDelay({
      message: `RSS fetch failed for feed ${feedId}: ${message}`,
      retryDelay: "30s",
      forceDelayTime: false,
    });
  }

  await markFeedSynced(feedId);

  console.log(
    JSON.stringify({
      event: "sync-feed.complete",
      feedId,
      userId,
      itemsSynced,
    }),
  );
});

export const asyncWorkloadConfig: AsyncWorkloadConfig<SyncFeedEvent> = {
  events: [SYNC_FEED_EVENT_NAME],
  maxRetries: 4,
  backoffSchedule: (attempt) => {
    if (attempt === 0) {
      return "30s";
    }
    if (attempt === 1) {
      return "2m";
    }
    if (attempt === 2) {
      return "10m";
    }
    return "30m";
  },
};
