import { ref } from "vue";
import {
  syncQueueStore,
  type ClientDb,
  type SyncQueueAction,
  type SyncQueueRow,
} from "./syncQueueStore";

// A queued mutation gets this many attempts against a transient failure
// (network error, 5xx) before it's quarantined too — a persistently-erroring
// server must not retry forever and silently pile up behind it.
const MAX_SYNC_ATTEMPTS = 5;
const DEFAULT_SYNC_ERROR_MESSAGE = "Sync failed";

// Number of sync_queue rows currently quarantined (status "failed"). Module-
// level so every useSyncQueue() call — the sync plugin, the UI banner —
// shares the same reactive count instead of each holding its own copy.
const failedCount = ref(0);

function extractStatusCode(error: unknown): number | null {
  const hasNumericStatusCode =
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number";

  return hasNumericStatusCode
    ? (error as { statusCode: number }).statusCode
    : null;
}

// A 4xx response means the server rejected the request itself (ownership
// check, validation, unknown action) — retrying the exact same payload can
// never succeed. Anything else (no status, a network error, a 5xx) is
// transient and worth retrying.
function isPermanentFailure(statusCode: number | null): boolean {
  return statusCode !== null && statusCode >= 400 && statusCode < 500;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : DEFAULT_SYNC_ERROR_MESSAGE;
}

// Records a failed sync attempt and decides its fate. Returns whether the
// item is still retryable — false means it was quarantined (permanent 4xx,
// or its retry budget is exhausted).
async function handleSyncFailure(
  db: ClientDb,
  item: SyncQueueRow,
  error: unknown,
): Promise<boolean> {
  const statusCode = extractStatusCode(error);
  const message = describeError(error);
  const attempts = item.attempts + 1;
  const retryBudgetExhausted = attempts >= MAX_SYNC_ATTEMPTS;

  if (isPermanentFailure(statusCode) || retryBudgetExhausted) {
    await syncQueueStore.quarantine(db, item.id, attempts, message);
    return false;
  }

  await syncQueueStore.recordRetryableFailure(db, item.id, attempts, message);
  return true;
}

// Sends one queued item to the server and reconciles its local state.
// Returns whether the caller should stop processing the rest of this pass —
// true only for a still-retryable transient failure, so item ordering is
// preserved for the next flush. Permanent failures are quarantined here and
// never stop the pass, so they can't block items queued behind them.
async function syncItem(db: ClientDb, item: SyncQueueRow): Promise<boolean> {
  try {
    await $fetch("/api/sync", {
      method: "POST",
      body: { action: item.action, payload: JSON.parse(item.payload) },
    });
    await syncQueueStore.markSynced(db, item.id);
    return false;
  } catch (error) {
    return handleSyncFailure(db, item, error);
  }
}

export function useSyncQueue() {
  async function queueAction(
    action: SyncQueueAction,
    payload: Record<string, unknown>,
  ) {
    const db = await useClientDb();
    await syncQueueStore.insertAction(db, action, JSON.stringify(payload));
  }

  async function refreshFailedCount(): Promise<void> {
    const db = await useClientDb();
    failedCount.value = await syncQueueStore.countFailedItems(db);
  }

  async function flushSyncQueue() {
    if (!navigator.onLine) return;

    const db = await useClientDb();
    const pending = await syncQueueStore.getPendingItems(db);

    for (const item of pending) {
      const stillRetryable = await syncItem(db, item);
      if (stillRetryable) break;
    }

    await refreshFailedCount();
  }

  return { queueAction, flushSyncQueue, failedCount, refreshFailedCount };
}
