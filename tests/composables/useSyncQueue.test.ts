import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSyncQueue } from "~/composables/useSyncQueue";
import { syncQueueStore } from "~/composables/syncQueueStore";

vi.mock("~/composables/syncQueueStore", () => ({
  syncQueueStore: {
    insertAction: vi.fn(),
    getPendingItems: vi.fn(),
    countFailedItems: vi.fn(),
    markSynced: vi.fn(),
    recordRetryableFailure: vi.fn(),
    quarantine: vi.fn(),
    requeueFailedItems: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

const fakeDb = { name: "fake-db" };
const mockUseClientDb = vi.fn();
vi.stubGlobal("useClientDb", mockUseClientDb);

function makeItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    action: "markRead",
    payload: JSON.stringify({ feedId: 1, guid: "abc" }),
    attempts: 0,
    status: "pending",
    lastError: null,
    failedAt: null,
    createdAt: new Date("2026-01-01"),
    syncedAt: null,
    ...overrides,
  };
}

describe("useSyncQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("navigator", { onLine: true });
    mockUseClientDb.mockResolvedValue(fakeDb);
    vi.mocked(syncQueueStore.countFailedItems).mockResolvedValue(0);
  });

  describe("queueAction()", () => {
    it("inserts the action with a JSON-stringified payload", async () => {
      const { queueAction } = useSyncQueue();
      await queueAction("star", { feedId: 1, guid: "abc", starred: true });
      expect(syncQueueStore.insertAction).toHaveBeenCalledWith(
        fakeDb,
        "star",
        JSON.stringify({ feedId: 1, guid: "abc", starred: true }),
      );
    });
  });

  describe("flushSyncQueue()", () => {
    it("does nothing while offline", async () => {
      vi.stubGlobal("navigator", { onLine: false });
      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();
      expect(syncQueueStore.getPendingItems).not.toHaveBeenCalled();
    });

    it("drains the queue fully when every item succeeds", async () => {
      const items = [makeItem({ id: 1 }), makeItem({ id: 2 })];
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue(items);
      mockFetch.mockResolvedValue({ ok: true });

      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(syncQueueStore.markSynced).toHaveBeenCalledWith(fakeDb, 1);
      expect(syncQueueStore.markSynced).toHaveBeenCalledWith(fakeDb, 2);
      expect(syncQueueStore.quarantine).not.toHaveBeenCalled();
      expect(syncQueueStore.recordRetryableFailure).not.toHaveBeenCalled();
    });

    it("quarantines a permanently-failing (403) item without blocking items behind it", async () => {
      const items = [makeItem({ id: 1 }), makeItem({ id: 2 })];
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue(items);
      const forbidden = Object.assign(new Error("Forbidden"), {
        statusCode: 403,
      });
      mockFetch
        .mockRejectedValueOnce(forbidden)
        .mockResolvedValueOnce({ ok: true });

      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(syncQueueStore.quarantine).toHaveBeenCalledWith(
        fakeDb,
        1,
        1,
        "Forbidden",
      );
      expect(syncQueueStore.markSynced).toHaveBeenCalledWith(fakeDb, 2);
      expect(syncQueueStore.recordRetryableFailure).not.toHaveBeenCalled();
    });

    it("keeps a transiently-failing item queued for retry and stops the pass", async () => {
      const items = [makeItem({ id: 1 }), makeItem({ id: 2 })];
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue(items);
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(syncQueueStore.recordRetryableFailure).toHaveBeenCalledWith(
        fakeDb,
        1,
        1,
        "Network error",
      );
      expect(syncQueueStore.quarantine).not.toHaveBeenCalled();
      expect(syncQueueStore.markSynced).not.toHaveBeenCalled();
    });

    it("keeps a 5xx failure queued for retry rather than quarantining it", async () => {
      const items = [makeItem({ id: 1 })];
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue(items);
      const serverError = Object.assign(new Error("Bad Gateway"), {
        statusCode: 502,
      });
      mockFetch.mockRejectedValueOnce(serverError);

      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();

      expect(syncQueueStore.recordRetryableFailure).toHaveBeenCalledWith(
        fakeDb,
        1,
        1,
        "Bad Gateway",
      );
      expect(syncQueueStore.quarantine).not.toHaveBeenCalled();
    });

    it("treats a 401 as retryable rather than quarantining the whole queue", async () => {
      // A 401 means the session needs refreshing, not that the mutation
      // itself is invalid — quarantining it would nuke every pending item
      // in a single flush the moment a session expires.
      const items = [makeItem({ id: 1 }), makeItem({ id: 2 })];
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue(items);
      const unauthorized = Object.assign(new Error("Unauthorized"), {
        statusCode: 401,
      });
      mockFetch.mockRejectedValueOnce(unauthorized);

      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(syncQueueStore.recordRetryableFailure).toHaveBeenCalledWith(
        fakeDb,
        1,
        1,
        "Unauthorized",
      );
      expect(syncQueueStore.quarantine).not.toHaveBeenCalled();
    });

    it("quarantines an item with an unparseable payload without calling $fetch", async () => {
      const items = [
        makeItem({ id: 1, payload: "{not valid json" }),
        makeItem({ id: 2 }),
      ];
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue(items);
      mockFetch.mockResolvedValue({ ok: true });

      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();

      expect(syncQueueStore.quarantine).toHaveBeenCalledWith(
        fakeDb,
        1,
        1,
        expect.any(String),
      );
      // Item 1 never reached the network — only item 2's request was made.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(syncQueueStore.markSynced).toHaveBeenCalledWith(fakeDb, 2);
    });

    it("does not start a second pass while one is already in flight", async () => {
      const items = [makeItem({ id: 1 })];
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue(items);
      mockFetch.mockResolvedValue({ ok: true });

      // Two callers firing back to back (e.g. the "online" and
      // "visibilitychange" listeners both reacting to the same reconnect)
      // must share one pass rather than each reading their own snapshot of
      // `attempts` and double-incrementing it.
      const { flushSyncQueue } = useSyncQueue();
      const firstPass = flushSyncQueue();
      const secondPass = flushSyncQueue();
      await Promise.all([firstPass, secondPass]);

      expect(syncQueueStore.getPendingItems).toHaveBeenCalledTimes(1);
    });

    it("respects the retry bound — keeps retrying below it", async () => {
      const item = makeItem({ id: 1, attempts: 3 });
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue([item]);
      mockFetch.mockRejectedValueOnce(new Error("Still down"));

      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();

      expect(syncQueueStore.recordRetryableFailure).toHaveBeenCalledWith(
        fakeDb,
        1,
        4,
        "Still down",
      );
      expect(syncQueueStore.quarantine).not.toHaveBeenCalled();
    });

    it("respects the retry bound — quarantines once it's reached", async () => {
      const item = makeItem({ id: 1, attempts: 4 });
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue([item]);
      mockFetch.mockRejectedValueOnce(new Error("Still down"));

      const { flushSyncQueue } = useSyncQueue();
      await flushSyncQueue();

      expect(syncQueueStore.quarantine).toHaveBeenCalledWith(
        fakeDb,
        1,
        5,
        "Still down",
      );
      expect(syncQueueStore.recordRetryableFailure).not.toHaveBeenCalled();
    });

    it("refreshes failedCount after a pass", async () => {
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue([]);
      vi.mocked(syncQueueStore.countFailedItems).mockResolvedValue(3);

      const { flushSyncQueue, failedCount } = useSyncQueue();
      await flushSyncQueue();

      expect(failedCount.value).toBe(3);
    });
  });

  describe("refreshFailedCount()", () => {
    it("sets failedCount from the store", async () => {
      vi.mocked(syncQueueStore.countFailedItems).mockResolvedValue(2);
      const { refreshFailedCount, failedCount } = useSyncQueue();
      await refreshFailedCount();
      expect(failedCount.value).toBe(2);
    });

    it("falls back to 0 instead of rejecting when the store throws", async () => {
      vi.mocked(syncQueueStore.countFailedItems).mockRejectedValue(
        new Error("DB unavailable"),
      );
      const { refreshFailedCount, failedCount } = useSyncQueue();
      await expect(refreshFailedCount()).resolves.toBeUndefined();
      expect(failedCount.value).toBe(0);
    });
  });

  describe("retryFailedItems()", () => {
    it("re-queues failed items and immediately attempts a flush", async () => {
      vi.mocked(syncQueueStore.getPendingItems).mockResolvedValue([]);

      const { retryFailedItems } = useSyncQueue();
      await retryFailedItems();

      expect(syncQueueStore.requeueFailedItems).toHaveBeenCalledWith(fakeDb);
      expect(syncQueueStore.getPendingItems).toHaveBeenCalled();
    });
  });
});
