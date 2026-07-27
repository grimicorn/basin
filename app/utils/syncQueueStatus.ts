// Named status values for a queued client-side sync mutation (see
// app/db/schema.ts's syncQueue table). "pending" items are eligible for
// flushSyncQueue to retry; "failed" means the item was quarantined — either
// a permanent 4xx from /api/sync, or a transient failure that exhausted its
// retry budget — and is excluded from future flush passes. Centralized here
// so callers never hardcode the string literals (mirrors
// server/utils/syncStatus.ts's SYNC_STATUS for the same reason).
export const SYNC_QUEUE_STATUS = {
  PENDING: "pending",
  FAILED: "failed",
} as const;

export type SyncQueueStatus =
  (typeof SYNC_QUEUE_STATUS)[keyof typeof SYNC_QUEUE_STATUS];
