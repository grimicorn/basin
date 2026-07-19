// Named status values for feed/integration sync health. Stored as plain text
// columns (matching the rest of the schema's status columns, e.g.
// subscriptions.status), but centralized here so callers never hardcode the
// string literals.
export const SYNC_STATUS = {
  OK: "ok",
  ERROR: "error",
} as const;

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];
