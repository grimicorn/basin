import type { Config } from "@netlify/functions";
import { AsyncWorkloadsClient } from "@netlify/async-workloads";
import { lte, or, isNull } from "drizzle-orm";
import { useDb } from "../../server/db/index";
import { feeds } from "../../server/db/schema";
import type { SyncFeedPayload } from "../../server/utils/syncFeedWorkload";

// How long after last_synced_at before a feed is considered due for refresh.
const SYNC_CADENCE_MS = 60 * 60 * 1000; // 1 hour

// Run the scheduler every 15 minutes so feeds are refreshed roughly on cadence.
export const config: Config = {
  schedule: "*/15 * * * *",
};

function dueCutoff(): Date {
  return new Date(Date.now() - SYNC_CADENCE_MS);
}

async function loadDueFeeds() {
  const db = useDb();
  const cutoff = dueCutoff();

  return db.query.feeds.findMany({
    where: or(isNull(feeds.lastSyncedAt), lte(feeds.lastSyncedAt, cutoff)),
    with: { user: true },
  });
}

async function emitSyncEvent(
  client: AsyncWorkloadsClient,
  payload: SyncFeedPayload,
): Promise<boolean> {
  const result = await client.send("sync-feed", { data: payload });

  if (result.sendStatus !== "succeeded") {
    console.error(
      JSON.stringify({
        event: "schedule_emit_failed",
        feedId: payload.feedId,
        userId: payload.userId,
        sendStatus: result.sendStatus,
      }),
    );
    return false;
  }

  return true;
}

export default async function handler(): Promise<void> {
  const dueFeeds = await loadDueFeeds();

  console.log(
    JSON.stringify({
      event: "schedule_run",
      dueCount: dueFeeds.length,
    }),
  );

  const client = new AsyncWorkloadsClient();

  for (const feed of dueFeeds) {
    const payload: SyncFeedPayload = {
      userId: feed.userId,
      feedId: feed.id,
      sourceType: feed.source,
      mode: "scheduled",
    };

    const emitted = await emitSyncEvent(client, payload);

    if (emitted) {
      console.log(
        JSON.stringify({
          event: "schedule_event_emitted",
          feedId: feed.id,
          userId: feed.userId,
          sourceType: feed.source,
        }),
      );
    }
  }
}
