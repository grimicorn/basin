import { AsyncWorkloadsClient } from "@netlify/async-workloads";
import { eq } from "drizzle-orm";
import { feeds } from "../db/schema";
import type { SyncFeedPayload } from "../utils/syncFeedWorkload";

/**
 * Fetches all feeds owned by a user.
 *
 * @returns An array of feed records for the user.
 */
async function loadUserFeeds(userId: number) {
  return useDb().query.feeds.findMany({
    where: eq(feeds.userId, userId),
  });
}

/**
 * Enqueues feed synchronization workload events for each provided payload.
 *
 * @param payloads - Feed sync payloads to enqueue
 * @returns The count of successfully enqueued events
 */
async function emitSyncEvents(
  client: AsyncWorkloadsClient,
  payloads: SyncFeedPayload[],
): Promise<number> {
  let successCount = 0;

  for (const payload of payloads) {
    const result = await client.send("sync-feed", {
      data: payload,
      priority: 10,
    });

    if (result.sendStatus !== "succeeded") {
      console.error(
        JSON.stringify({
          event: "on_demand_emit_failed",
          feedId: payload.feedId,
          userId: payload.userId,
          sendStatus: result.sendStatus,
        }),
      );
      continue;
    }

    successCount += 1;
  }

  return successCount;
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const userFeeds = await loadUserFeeds(user.id);

  if (userFeeds.length === 0) {
    return { queued: 0 };
  }

  const client = new AsyncWorkloadsClient();

  const payloads: SyncFeedPayload[] = userFeeds.map((feed) => ({
    userId: user.id,
    feedId: feed.id,
    sourceType: feed.source,
    mode: "on-demand",
  }));

  const successCount = await emitSyncEvents(client, payloads);

  console.log(
    JSON.stringify({
      event: "on_demand_sync_requested",
      userId: user.id,
      queued: successCount,
    }),
  );

  return { queued: successCount };
});
