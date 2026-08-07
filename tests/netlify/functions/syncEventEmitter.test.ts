import { describe, it, expect, vi } from "vitest";
import {
  emitSyncFeedEvents,
  EMIT_BATCH_SIZE,
} from "../../../netlify/functions/syncEventEmitter";
import { SYNC_FEED_EVENT_NAME } from "../../../netlify/functions/types";
import type { SyncFeedEventData } from "../../../netlify/functions/types";
import type { SyncEventClient } from "../../../netlify/functions/syncEventEmitter";

function makeEvent(
  overrides: Partial<SyncFeedEventData> = {},
): SyncFeedEventData {
  return {
    userId: 1,
    feedId: 1,
    sourceType: "rss",
    mode: "on-demand",
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (_value: T) => void;
  const promise = new Promise<T>((resolveExecutor) => {
    resolve = resolveExecutor;
  });
  return { promise, resolve };
}

function stubClient(send: SyncEventClient["send"]): SyncEventClient {
  return { send };
}

describe("emitSyncFeedEvents", () => {
  it("returns a success outcome with the eventId for each emitted feed", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ sendStatus: "succeeded", eventId: "evt" });
    const events = [makeEvent({ feedId: 1 }), makeEvent({ feedId: 2 })];

    const results = await emitSyncFeedEvents(stubClient(send), events);

    expect(results).toEqual([
      { feedId: 1, success: true, eventId: "evt" },
      { feedId: 2, success: true, eventId: "evt" },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("omits priority from the payload when none is provided", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ sendStatus: "succeeded", eventId: "evt" });

    await emitSyncFeedEvents(stubClient(send), [makeEvent({ feedId: 7 })]);

    expect(send).toHaveBeenCalledWith(SYNC_FEED_EVENT_NAME, {
      data: makeEvent({ feedId: 7 }),
    });
  });

  it("forwards priority into the payload when provided", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ sendStatus: "succeeded", eventId: "evt" });

    await emitSyncFeedEvents(stubClient(send), [makeEvent({ feedId: 7 })], {
      priority: 25,
    });

    expect(send).toHaveBeenCalledWith(SYNC_FEED_EVENT_NAME, {
      data: makeEvent({ feedId: 7 }),
      priority: 25,
    });
  });

  it("continues past a rejected emit and still processes the remaining feeds", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ sendStatus: "succeeded", eventId: "evt-1" })
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ sendStatus: "succeeded", eventId: "evt-3" });
    const events = [
      makeEvent({ feedId: 1 }),
      makeEvent({ feedId: 2 }),
      makeEvent({ feedId: 3 }),
    ];

    const results = await emitSyncFeedEvents(stubClient(send), events);

    expect(send).toHaveBeenCalledTimes(3);
    expect(results.filter((result) => result.success)).toHaveLength(2);
    expect(results.find((result) => result.feedId === 2)).toEqual({
      feedId: 2,
      success: false,
      error: "network down",
    });
  });

  it("treats a non-succeeded sendStatus as a failed outcome without aborting", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ sendStatus: "failed", eventId: "" })
      .mockResolvedValueOnce({ sendStatus: "succeeded", eventId: "evt-2" });
    const events = [makeEvent({ feedId: 1 }), makeEvent({ feedId: 2 })];

    const results = await emitSyncFeedEvents(stubClient(send), events);

    expect(send).toHaveBeenCalledTimes(2);
    expect(results[0].success).toBe(false);
    expect(results[1]).toEqual({ feedId: 2, success: true, eventId: "evt-2" });
  });

  it("emits in sequential batches instead of firing everything at once", async () => {
    const total = EMIT_BATCH_SIZE + 3;
    const events = Array.from({ length: total }, (_, index) =>
      makeEvent({ feedId: index + 1 }),
    );
    const deferreds = Array.from({ length: total }, () =>
      createDeferred<{ sendStatus: string; eventId: string }>(),
    );
    let callIndex = 0;
    const send = vi.fn(() => deferreds[callIndex++].promise);

    const resultsPromise = emitSyncFeedEvents(stubClient(send), events);

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(EMIT_BATCH_SIZE));
    expect(send).toHaveBeenCalledTimes(EMIT_BATCH_SIZE);

    deferreds
      .slice(0, EMIT_BATCH_SIZE)
      .forEach((deferred, index) =>
        deferred.resolve({ sendStatus: "succeeded", eventId: `evt-${index}` }),
      );

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(total));
    deferreds.slice(EMIT_BATCH_SIZE).forEach((deferred, index) =>
      deferred.resolve({
        sendStatus: "succeeded",
        eventId: `evt-${EMIT_BATCH_SIZE + index}`,
      }),
    );

    const results = await resultsPromise;
    expect(results).toHaveLength(total);
    expect(results.every((result) => result.success)).toBe(true);
  });
});
