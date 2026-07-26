import { and, eq } from "drizzle-orm";
import { feeds } from "../db/schema";
import { useDb } from "./db";
import { SYNC_STATUS } from "./syncStatus";

// Clears any recorded sync failure on every feed of the given source for
// this user. Called from the connect/reconnect handlers: a successful
// (re)connect proves the account works again, so a feed that previously
// failed against it (e.g. an expired YouTube token) shouldn't keep showing
// "Needs attention" until its next scheduled sync happens to run.
export async function clearFeedSyncFailures(
  db: ReturnType<typeof useDb>,
  userId: number,
  source: string,
): Promise<void> {
  await db
    .update(feeds)
    .set({ syncStatus: SYNC_STATUS.OK, syncError: null, syncFailedAt: null })
    .where(and(eq(feeds.userId, userId), eq(feeds.source, source)));
}
