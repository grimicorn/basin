import type { Config } from "@netlify/functions";
import { inArray, lt } from "drizzle-orm";
import { processedStripeEvents } from "../../server/db/schema";
import { createDb } from "./db";

// The processed_stripe_events table is a dedup log the Stripe webhook uses to
// treat a redelivered event as a no-op. Stripe retries webhook delivery for up
// to ~3 days, so a row only needs to outlive that retry window to keep doing
// its job; anything older can never match a fresh redelivery. Seven days gives
// a safe margin past the ~3-day retry window while keeping the table bounded.
// The processed_stripe_events_processed_at_idx index supports this range query.
export const STRIPE_EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// This table shipped append-only, so the first prune faces the whole accrued
// backlog. Delete in bounded batches and cap the batches per run so a large
// backlog can never exceed the scheduled function's execution budget in one
// statement — an unfinished run just resumes on the next nightly invocation.
export const PRUNE_BATCH_SIZE = 5000;
export const MAX_PRUNE_BATCHES = 20;

type Database = ReturnType<typeof createDb>;

async function deleteExpiredBatch(db: Database, cutoff: Date): Promise<number> {
  const expired = await db
    .select({ id: processedStripeEvents.id })
    .from(processedStripeEvents)
    .where(lt(processedStripeEvents.processedAt, cutoff))
    .limit(PRUNE_BATCH_SIZE);

  if (expired.length === 0) {
    return 0;
  }

  await db.delete(processedStripeEvents).where(
    inArray(
      processedStripeEvents.id,
      expired.map((row) => row.id),
    ),
  );

  return expired.length;
}

async function pruneExpiredEvents(
  cutoff: Date,
): Promise<{ deletedCount: number; complete: boolean }> {
  const db = createDb();
  let deletedCount = 0;

  for (let batch = 0; batch < MAX_PRUNE_BATCHES; batch += 1) {
    const removed = await deleteExpiredBatch(db, cutoff);
    deletedCount += removed;

    if (removed < PRUNE_BATCH_SIZE) {
      return { deletedCount, complete: true };
    }
  }

  return { deletedCount, complete: false };
}

export default async function scheduledStripeEventsCleanup() {
  const cutoff = new Date(Date.now() - STRIPE_EVENT_RETENTION_MS);

  try {
    const { deletedCount, complete } = await pruneExpiredEvents(cutoff);

    console.log(
      JSON.stringify({
        event: "scheduled-stripe-events-cleanup.complete",
        cutoff: cutoff.toISOString(),
        deletedCount,
        complete,
      }),
    );

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "scheduled-stripe-events-cleanup.error",
        cutoff: cutoff.toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}

export const config: Config = {
  // Run daily at 03:00 UTC — the retention window is measured in days, so a
  // once-a-day prune keeps the table bounded without churning the DB.
  schedule: "0 3 * * *",
};
