import { and, asc, eq, isNull, type InferSelectModel } from "drizzle-orm";
import { syncQueue } from "~/db/schema";
import { SYNC_QUEUE_STATUS } from "~/utils/syncQueueStatus";
import type { ClientDb } from "~/composables/useClientDb";

export type SyncQueueRow = InferSelectModel<typeof syncQueue>;
export type SyncQueueAction = "markRead" | "star" | "save";
export type { ClientDb };

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
      // id as a tiebreaker: createdAt defaults to the transaction clock, so
      // two rows queued in the same instant would otherwise sort in an
      // arbitrary order and could apply out of sequence (e.g. an older
      // "star: false" landing after a newer "star: true").
      orderBy: [asc(syncQueue.createdAt), asc(syncQueue.id)],
    });
  },

  async countFailedItems(db: ClientDb): Promise<number> {
    return db.$count(syncQueue, eq(syncQueue.status, SYNC_QUEUE_STATUS.FAILED));
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

  // User-initiated "try again" — puts every quarantined item back in line
  // for the next flush pass with a clean retry budget.
  async requeueFailedItems(db: ClientDb): Promise<void> {
    await db
      .update(syncQueue)
      .set({
        status: SYNC_QUEUE_STATUS.PENDING,
        attempts: 0,
        lastError: null,
        failedAt: null,
      })
      .where(eq(syncQueue.status, SYNC_QUEUE_STATUS.FAILED));
  },
};
