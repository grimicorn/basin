import type { Config } from "@netlify/functions";
import { AsyncWorkloadsClient } from "@netlify/async-workloads";
import { and, lt, or, isNull, inArray } from "drizzle-orm";
import { feeds } from "../../server/db/schema";
import { createDb } from "./db";
import { DEBOUNCE_WINDOW_MS } from "./types";
import type { SyncFeedEventData } from "./types";
import { emitSyncFeedEvents } from "./syncEventEmitter";
import type { FeedEmitResult } from "./syncEventEmitter";

type DueFeed = { id: number; userId: number; source: string };

// Source types that this scheduler knows how to sync via async workloads.
const SYNCABLE_SOURCE_TYPES = ["rss", "podcast", "youtube", "bluesky"] as const;

async function fetchDueFeeds(): Promise<DueFeed[]> {
  const db = createDb();
  const cutoffTime = new Date(Date.now() - DEBOUNCE_WINDOW_MS);

  return db.query.feeds.findMany({
    where: and(
      inArray(feeds.source, [...SYNCABLE_SOURCE_TYPES]),
      or(isNull(feeds.lastFetched), lt(feeds.lastFetched, cutoffTime)),
    ),
    columns: {
      id: true,
      userId: true,
      source: true,
    },
  });
}

function toSyncEventData(feed: DueFeed): SyncFeedEventData {
  return {
    userId: feed.userId,
    feedId: feed.id,
    sourceType: feed.source as SyncFeedEventData["sourceType"],
    mode: "scheduled",
  };
}

function logEmitResult(result: FeedEmitResult): void {
  if (result.success) {
    console.log(
      JSON.stringify({
        event: "scheduled-feed-sync.emitted",
        feedId: result.feedId,
        eventId: result.eventId,
      }),
    );
    return;
  }

  console.error(
    JSON.stringify({
      event: "scheduled-feed-sync.emit-failed",
      feedId: result.feedId,
      error: result.error,
    }),
  );
}

export default async function scheduledFeedSync() {
  const dueFeeds = await fetchDueFeeds();

  if (dueFeeds.length === 0) {
    console.log(JSON.stringify({ event: "scheduled-feed-sync.no-due-feeds" }));
    return new Response(null, { status: 200 });
  }

  console.log(
    JSON.stringify({
      event: "scheduled-feed-sync.start",
      dueCount: dueFeeds.length,
    }),
  );

  const client = new AsyncWorkloadsClient();
  const results = await emitSyncFeedEvents(
    client,
    dueFeeds.map(toSyncEventData),
  );
  results.forEach(logEmitResult);

  const emitted = results.filter((result) => result.success).length;
  const failed = results.length - emitted;

  console.log(
    JSON.stringify({ event: "scheduled-feed-sync.complete", emitted, failed }),
  );

  return new Response(null, { status: 200 });
}

export const config: Config = {
  // Run every 15 minutes
  schedule: "*/15 * * * *",
};
