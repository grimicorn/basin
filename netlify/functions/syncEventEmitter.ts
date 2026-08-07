import { SYNC_FEED_EVENT_NAME } from "./types";
import type { SyncFeedEventData } from "./types";

// Feeds are emitted in sequential batches of this size so a large backlog does
// not fire hundreds of concurrent requests at the workloads service at once.
export const EMIT_BATCH_SIZE = 25;

// Minimal surface of AsyncWorkloadsClient this module depends on. Declaring it
// here keeps the external service behind a mockable abstraction so the emit
// logic can be unit-tested with a plain stub instead of the real client.
export interface SyncEventClient {
  send(
    _eventName: typeof SYNC_FEED_EVENT_NAME,
    _options: { data: SyncFeedEventData; priority?: number },
  ): Promise<{ sendStatus: string; eventId: string }>;
}

export interface FeedEmitResult {
  feedId: number;
  success: boolean;
  eventId?: string;
  error?: string;
}

export interface EmitSyncEventsOptions {
  priority?: number;
  batchSize?: number;
}

async function sendSyncEvent(
  client: SyncEventClient,
  data: SyncFeedEventData,
  priority?: number,
): Promise<string> {
  const options = priority === undefined ? { data } : { data, priority };
  const result = await client.send(SYNC_FEED_EVENT_NAME, options);

  if (result.sendStatus !== "succeeded") {
    throw new Error(
      `Failed to emit sync-feed event for feed ${data.feedId}: status=${result.sendStatus}`,
    );
  }

  return result.eventId;
}

async function emitSingleEvent(
  client: SyncEventClient,
  data: SyncFeedEventData,
  priority?: number,
): Promise<FeedEmitResult> {
  try {
    const eventId = await sendSyncEvent(client, data, priority);
    return { feedId: data.feedId, success: true, eventId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { feedId: data.feedId, success: false, error: message };
  }
}

// Emits one sync-feed event per entry, tolerating per-feed failures so a single
// bad emit never aborts the rest. Returns a per-feed outcome for each entry.
export async function emitSyncFeedEvents(
  client: SyncEventClient,
  events: SyncFeedEventData[],
  options: EmitSyncEventsOptions = {},
): Promise<FeedEmitResult[]> {
  const batchSize = options.batchSize ?? EMIT_BATCH_SIZE;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new RangeError("batchSize must be a positive integer");
  }

  const results: FeedEmitResult[] = [];

  for (let index = 0; index < events.length; index += batchSize) {
    const batch = events.slice(index, index + batchSize);
    const settled = await Promise.all(
      batch.map((data) => emitSingleEvent(client, data, options.priority)),
    );
    results.push(...settled);
  }

  return results;
}
