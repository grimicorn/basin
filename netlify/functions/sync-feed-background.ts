import {
  asyncWorkloadFn,
  type AsyncWorkloadConfig,
  type CustomAsyncWorkloadEvent,
} from "@netlify/async-workloads";
import { useDb } from "../../server/db/index";
import {
  syncFeed,
  type SyncFeedPayload,
} from "../../server/utils/syncFeedWorkload";

type SyncFeedEvent = CustomAsyncWorkloadEvent & {
  eventName: "sync-feed";
  eventData: SyncFeedPayload;
};

export const config: AsyncWorkloadConfig<SyncFeedEvent> = {
  name: "sync-feed",
  events: ["sync-feed"],
  maxRetries: 4,
};

export default asyncWorkloadFn<SyncFeedEvent>(async (event) => {
  const { userId, feedId, sourceType, mode } = event.eventData;

  console.log(
    JSON.stringify({
      event: "workload_invoked",
      eventId: event.eventId,
      attempt: event.attempt,
      userId,
      feedId,
      sourceType,
      mode,
    }),
  );

  const db = useDb();
  const result = await syncFeed(db, { userId, feedId, sourceType, mode });

  if (result.skipped) {
    console.log(
      JSON.stringify({
        event: "workload_skipped",
        eventId: event.eventId,
        feedId,
        reason: result.reason,
      }),
    );
    return;
  }

  console.log(
    JSON.stringify({
      event: "workload_complete",
      eventId: event.eventId,
      feedId,
      upsertedCount: result.upsertedCount,
    }),
  );
});
