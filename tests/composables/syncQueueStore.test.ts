// Unlike useSyncQueue.test.ts (which mocks this store entirely to unit test
// the retry/quarantine orchestration), this file exercises syncQueueStore
// against a real, in-memory PGlite instance. That's the only way to verify
// the actual WHERE clauses — e.g. that quarantined ("failed") rows are
// genuinely excluded from getPendingItems, not just that useSyncQueue.ts
// calls the store correctly.
import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  feeds,
  feedItems,
  feedsRelations,
  feedItemsRelations,
  syncQueue,
} from "~/db/schema";
import { MIGRATIONS } from "~/composables/useClientDb";
import { syncQueueStore } from "~/composables/syncQueueStore";
import { SYNC_QUEUE_STATUS } from "~/utils/syncQueueStatus";

const schema = {
  feeds,
  feedItems,
  feedsRelations,
  feedItemsRelations,
  syncQueue,
};
type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  await client.exec(MIGRATIONS);
  return drizzle(client, { schema });
}

describe("syncQueueStore (real PGlite)", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("insertAction persists a pending, unsynced, zero-attempt row", async () => {
    await syncQueueStore.insertAction(db, "star", JSON.stringify({ id: 1 }));
    const [row] = await syncQueueStore.getPendingItems(db);

    expect(row.action).toBe("star");
    expect(row.status).toBe(SYNC_QUEUE_STATUS.PENDING);
    expect(row.attempts).toBe(0);
    expect(row.syncedAt).toBeNull();
  });

  it("getPendingItems excludes quarantined items but still returns items behind them", async () => {
    await syncQueueStore.insertAction(db, "star", JSON.stringify({ id: 1 }));
    await syncQueueStore.insertAction(
      db,
      "markRead",
      JSON.stringify({ id: 2 }),
    );
    const [first, second] = await syncQueueStore.getPendingItems(db);

    await syncQueueStore.quarantine(db, first.id, 1, "Forbidden");

    const pending = await syncQueueStore.getPendingItems(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(second.id);
  });

  it("getPendingItems excludes items already marked synced", async () => {
    await syncQueueStore.insertAction(db, "star", JSON.stringify({ id: 1 }));
    const [row] = await syncQueueStore.getPendingItems(db);

    await syncQueueStore.markSynced(db, row.id);

    const pending = await syncQueueStore.getPendingItems(db);
    expect(pending).toHaveLength(0);
  });

  it("countFailedItems only counts quarantined rows", async () => {
    await syncQueueStore.insertAction(db, "star", JSON.stringify({ id: 1 }));
    await syncQueueStore.insertAction(
      db,
      "markRead",
      JSON.stringify({ id: 2 }),
    );
    const [first] = await syncQueueStore.getPendingItems(db);

    expect(await syncQueueStore.countFailedItems(db)).toBe(0);

    await syncQueueStore.quarantine(db, first.id, 1, "Forbidden");
    expect(await syncQueueStore.countFailedItems(db)).toBe(1);
  });

  it("recordRetryableFailure increments attempts and keeps the row pending", async () => {
    await syncQueueStore.insertAction(db, "star", JSON.stringify({ id: 1 }));
    const [row] = await syncQueueStore.getPendingItems(db);

    await syncQueueStore.recordRetryableFailure(db, row.id, 1, "Network error");

    const [updated] = await syncQueueStore.getPendingItems(db);
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toBe("Network error");
    expect(updated.status).toBe(SYNC_QUEUE_STATUS.PENDING);
  });

  it("requeueFailedItems restores every quarantined row to pending with a clean slate", async () => {
    await syncQueueStore.insertAction(db, "star", JSON.stringify({ id: 1 }));
    const [row] = await syncQueueStore.getPendingItems(db);
    await syncQueueStore.quarantine(db, row.id, 5, "Forbidden");
    expect(await syncQueueStore.countFailedItems(db)).toBe(1);

    await syncQueueStore.requeueFailedItems(db);

    expect(await syncQueueStore.countFailedItems(db)).toBe(0);
    const [restored] = await syncQueueStore.getPendingItems(db);
    expect(restored.status).toBe(SYNC_QUEUE_STATUS.PENDING);
    expect(restored.attempts).toBe(0);
    expect(restored.lastError).toBeNull();
    expect(restored.failedAt).toBeNull();
  });
});
