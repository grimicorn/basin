import { AsyncWorkloadsClient } from "@netlify/async-workloads";
import { and, inArray, eq } from "drizzle-orm";
import { feeds } from "../db/schema";
import type { SyncFeedEventData } from "../../netlify/functions/types";
import { emitSyncFeedEvents } from "../../netlify/functions/syncEventEmitter";
import type { FeedEmitResult } from "../../netlify/functions/syncEventEmitter";

// Source types eligible for on-demand sync via async workloads.
const SYNCABLE_SOURCE_TYPES = ["rss", "podcast", "youtube", "bluesky"] as const;

// On-demand events run at elevated priority so users see results faster.
const ON_DEMAND_PRIORITY = 25;

type SyncableFeed = { id: number; source: string };

async function fetchUserSyncableFeeds(userId: number): Promise<SyncableFeed[]> {
  return useDb().query.feeds.findMany({
    where: and(
      eq(feeds.userId, userId),
      inArray(feeds.source, [...SYNCABLE_SOURCE_TYPES]),
    ),
    columns: {
      id: true,
      source: true,
    },
  });
}

function toSyncEventData(
  userId: number,
  feed: SyncableFeed,
): SyncFeedEventData {
  return {
    userId,
    feedId: feed.id,
    sourceType: feed.source as SyncFeedEventData["sourceType"],
    mode: "on-demand",
  };
}

function summarize(results: FeedEmitResult[]) {
  const succeeded = results.filter((result) => result.success);
  const eventIds = succeeded
    .map((result) => result.eventId)
    .filter((eventId): eventId is string => eventId !== undefined);

  return {
    queued: succeeded.length,
    failed: results.length - succeeded.length,
    eventIds,
  };
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userFeeds = await fetchUserSyncableFeeds(user.id);

  if (userFeeds.length === 0) {
    return { queued: 0, failed: 0, eventIds: [] };
  }

  const client = new AsyncWorkloadsClient();
  const events = userFeeds.map((feed) => toSyncEventData(user.id, feed));
  const results = await emitSyncFeedEvents(client, events, {
    priority: ON_DEMAND_PRIORITY,
  });

  return summarize(results);
});
