import { AsyncWorkloadsClient } from "@netlify/async-workloads";
import { eq } from "drizzle-orm";
import { feeds } from "../db/schema";
import type { SyncFeedPayload } from "../utils/syncFeedWorkload";

async function loadUserFeeds(userId: number) {
  return useDb().query.feeds.findMany({
    where: eq(feeds.userId, userId),
  });
}

async function emitSyncEvents(
  client: AsyncWorkloadsClient,
  payloads: SyncFeedPayload[],
): Promise<void> {
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
    }
  }
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

  await emitSyncEvents(client, payloads);

  console.log(
    JSON.stringify({
      event: "on_demand_sync_requested",
      userId: user.id,
      queued: payloads.length,
    }),
  );

  return { queued: payloads.length };
});
