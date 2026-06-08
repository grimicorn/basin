import { eq } from "drizzle-orm";
import { syncQueue } from "~/db/schema";

export function useSyncQueue() {
  async function queueAction(
    action: "markRead" | "star" | "save",
    payload: Record<string, unknown>,
  ) {
    const db = await useClientDb();
    await db.insert(syncQueue).values({
      action,
      payload: JSON.stringify(payload),
    });
  }

  async function flushSyncQueue() {
    if (!navigator.onLine) return;

    const db = await useClientDb();
    const pending = await db.query.syncQueue.findMany({
      where: (q, { isNull }) => isNull(q.syncedAt),
      orderBy: (q, { asc }) => [asc(q.createdAt)],
    });

    for (const item of pending) {
      try {
        await $fetch("/api/sync", {
          method: "POST",
          body: { action: item.action, payload: JSON.parse(item.payload) },
        });
        await db
          .update(syncQueue)
          .set({ syncedAt: new Date() })
          .where(eq(syncQueue.id, item.id));
      } catch {
        // Stop on first failure — retry on next flush
        break;
      }
    }
  }

  return { queueAction, flushSyncQueue };
}
