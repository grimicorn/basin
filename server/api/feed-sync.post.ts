import { AsyncWorkloadsClient } from "@netlify/async-workloads";
import { and, inArray, eq } from "drizzle-orm";
import { feeds } from "../db/schema";
import { SYNC_FEED_EVENT_NAME } from "../../netlify/functions/types";
import type { SyncFeedEventData } from "../../netlify/functions/types";

// Source types eligible for on-demand sync via async workloads.
const SYNCABLE_SOURCE_TYPES = ["rss", "podcast", "youtube"] as const;

// On-demand events run at elevated priority so users see results faster.
const ON_DEMAND_PRIORITY = 25;

async function fetchUserSyncableFeeds(userId: number) {
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

async function emitOnDemandEvent(
  client: AsyncWorkloadsClient,
  data: SyncFeedEventData,
): Promise<string> {
  const result = await client.send(SYNC_FEED_EVENT_NAME, {
    data,
    priority: ON_DEMAND_PRIORITY,
  });

  if (result.sendStatus !== "succeeded") {
    throw new Error(
      `Failed to emit sync-feed event for feed ${data.feedId}: status=${result.sendStatus}`,
    );
  }

  return result.eventId;
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userFeeds = await fetchUserSyncableFeeds(user.id);

  if (userFeeds.length === 0) {
    return { queued: 0, eventIds: [] };
  }

  const client = new AsyncWorkloadsClient();
  const eventIds: string[] = [];

  for (const feed of userFeeds) {
    const eventId = await emitOnDemandEvent(client, {
      userId: user.id,
      feedId: feed.id,
      sourceType: feed.source as SyncFeedEventData["sourceType"],
      mode: "on-demand",
    });

    eventIds.push(eventId);
  }

  return { queued: eventIds.length, eventIds };
});
