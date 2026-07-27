import { and, asc, eq, isNull, type InferSelectModel } from "drizzle-orm";
import { syncQueue } from "~/db/schema";
import { SYNC_QUEUE_STATUS } from "~/utils/syncQueueStatus";

export type SyncQueueRow = InferSelectModel<typeof syncQueue>;
export type SyncQueueAction = "markRead" | "star" | "save";
export type ClientDb = Awaited<ReturnType<typeof useClientDb>>;

// The only module that talks to the client PGlite database on behalf of
// useSyncQueue.ts — keeping the DB access isolated here means the retry and
// quarantine decisions in useSyncQueue.ts can be unit tested against a mock
// of this store instead of a real (or faked) drizzle/PGlite connection.
export const syncQueueStore = {
  async insertAction(
    db: ClientDb,
    action: SyncQueueAction,
    payload: string,
  ): Promise<void> {
    await db.insert(syncQueue).values({ action, payload });
  },

  async getPendingItems(db: ClientDb): Promise<SyncQueueRow[]> {
    return db.query.syncQueue.findMany({
      where: and(
        isNull(syncQueue.syncedAt),
        eq(syncQueue.status, SYNC_QUEUE_STATUS.PENDING),
      ),
      orderBy: [asc(syncQueue.createdAt)],
    });
  },

  async countFailedItems(db: ClientDb): Promise<number> {
    const failedItems = await db.query.syncQueue.findMany({
      where: eq(syncQueue.status, SYNC_QUEUE_STATUS.FAILED),
      columns: { id: true },
    });
    return failedItems.length;
  },

  async markSynced(db: ClientDb, id: number): Promise<void> {
    await db
      .update(syncQueue)
      .set({ syncedAt: new Date() })
      .where(eq(syncQueue.id, id));
  },

  async recordRetryableFailure(
    db: ClientDb,
    id: number,
    attempts: number,
    message: string,
  ): Promise<void> {
    await db
      .update(syncQueue)
      .set({ attempts, lastError: message })
      .where(eq(syncQueue.id, id));
  },

  async quarantine(
    db: ClientDb,
    id: number,
    attempts: number,
    message: string,
  ): Promise<void> {
    await db
      .update(syncQueue)
      .set({
        attempts,
        status: SYNC_QUEUE_STATUS.FAILED,
        lastError: message,
        failedAt: new Date(),
      })
      .where(eq(syncQueue.id, id));
  },
};
