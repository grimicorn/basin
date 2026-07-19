import { ErrorDoNotRetry } from "@netlify/async-workloads";
import { and, eq } from "drizzle-orm";
import { feeds, integrations } from "../../server/db/schema";
import { SYNC_STATUS } from "../../server/utils/syncStatus";
import { createDb } from "./db";

// Maps a feed's sourceType to the integration provider it depends on. RSS
// and podcast feeds have no backing integration, so they map to null and
// only the feed's own sync status is tracked for them. Used only on the
// success path — see IntegrationAuthError for how the failure path
// attributes a failure to a provider.
const SOURCE_TYPE_PROVIDER: Record<string, string | undefined> = {
  youtube: "youtube",
  bluesky: "bluesky",
};

export function providerForSourceType(sourceType: string): string | null {
  return SOURCE_TYPE_PROVIDER[sourceType] ?? null;
}

// Thrown instead of a plain ErrorDoNotRetry when a permanent failure is
// specifically attributable to the connected account (expired token with no
// refresh token, missing credentials) rather than the feed itself. This is
// the signal persistPermanentSyncFailure uses to decide whether the failure
// belongs on the integration too: a feed-only failure (source mismatch, feed
// deleted, retries exhausted on a network error) must never flag a healthy
// connection as needing reconnect.
export class IntegrationAuthError extends ErrorDoNotRetry {
  provider: string;

  constructor(provider: string, message: string) {
    super(message);
    this.name = "IntegrationAuthError";
    this.provider = provider;
  }
}

// Thrown for a permanent failure that is neither the feed's nor the
// connected account's fault — a server-side misconfiguration (e.g. a
// missing OAuth client secret). persistPermanentSyncFailure skips this
// entirely: it is not something the user did or can fix, so it must not be
// persisted as a feed/integration failure and shown to them as a "needs
// attention" tooltip. It still needs to reach an operator, so the caller is
// expected to log it before/instead of persisting.
export class ServerConfigError extends ErrorDoNotRetry {
  constructor(message: string) {
    super(message);
    this.name = "ServerConfigError";
  }
}

async function recordFeedSyncFailure(
  feedId: number,
  message: string,
): Promise<void> {
  const db = createDb();
  await db
    .update(feeds)
    .set({
      syncStatus: SYNC_STATUS.ERROR,
      syncError: message,
      syncFailedAt: new Date(),
    })
    .where(eq(feeds.id, feedId));
}

async function recordFeedSyncSuccess(
  feedId: number,
  syncedAt: Date,
): Promise<void> {
  const db = createDb();
  await db
    .update(feeds)
    .set({
      lastFetched: syncedAt,
      syncStatus: SYNC_STATUS.OK,
      syncError: null,
      syncFailedAt: null,
    })
    .where(eq(feeds.id, feedId));
}

async function recordIntegrationSyncFailure(
  userId: number,
  provider: string,
  message: string,
): Promise<void> {
  const db = createDb();
  await db
    .update(integrations)
    .set({
      syncStatus: SYNC_STATUS.ERROR,
      syncError: message,
      syncFailedAt: new Date(),
    })
    .where(
      and(eq(integrations.userId, userId), eq(integrations.provider, provider)),
    );
}

async function recordIntegrationSyncSuccess(
  userId: number,
  provider: string,
): Promise<void> {
  const db = createDb();
  await db
    .update(integrations)
    .set({ syncStatus: SYNC_STATUS.OK, syncError: null, syncFailedAt: null })
    .where(
      and(eq(integrations.userId, userId), eq(integrations.provider, provider)),
    );
}

// Persists a permanent (ErrorDoNotRetry) sync failure on the feed, and —
// only when the failure is an IntegrationAuthError — on the connected
// account too, so SettingsConnections can surface a "needs reconnect"
// indicator. A feed-only failure (source mismatch, feed deleted, retries
// exhausted on a transient error) must not touch the integration: the
// connection itself may be perfectly healthy. A ServerConfigError touches
// neither — it is not the user's fault, so nothing is persisted for the
// user to see. Looking the integration up by (userId, provider) rather than
// an id means this still works even when the error was raised before an
// integration row was ever loaded (e.g. "no integration found" failures).
export async function persistPermanentSyncFailure(
  userId: number,
  feedId: number,
  error: ErrorDoNotRetry,
): Promise<void> {
  if (error instanceof ServerConfigError) {
    return;
  }

  await recordFeedSyncFailure(feedId, error.message);

  if (!(error instanceof IntegrationAuthError)) {
    return;
  }

  await recordIntegrationSyncFailure(userId, error.provider, error.message);
}

// Marks a feed sync as successful and clears any previously-recorded failure
// on the feed and (when applicable) its backing integration.
export async function persistSyncSuccess(
  userId: number,
  feedId: number,
  sourceType: string,
  syncedAt: Date,
): Promise<void> {
  await recordFeedSyncSuccess(feedId, syncedAt);

  const provider = providerForSourceType(sourceType);
  if (!provider) {
    return;
  }

  await recordIntegrationSyncSuccess(userId, provider);
}
