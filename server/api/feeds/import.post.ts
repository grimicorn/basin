import { createFeedForUser, type CreatedFeed } from "../../utils/feedCreation";
import { parseOpml, OpmlParseError } from "../../utils/opml";

// Total wall-clock budget for the import loop, kept comfortably under a
// typical synchronous serverless function's request ceiling. A single feed
// validation can itself take up to feedCreation's own per-item timeout
// (10s), so this only bounds how many items the loop *starts* once that
// budget is spent — it cannot preempt an add already in flight.
const IMPORT_TIME_BUDGET_MS = 8_000;

interface SkippedEntry {
  url: string;
  title: string | null;
  reason: string;
}

interface ImportResult {
  imported: CreatedFeed[];
  skipped: SkippedEntry[];
  // Feed outlines present in the file but never attempted because the
  // document exceeded the maximum entries per import (see opml.ts) or the
  // import ran out of its time budget partway through.
  truncatedCount: number;
}

function reasonFromError(err: unknown): string {
  if (err instanceof Error && "statusMessage" in err) {
    const statusMessage = (err as { statusMessage?: unknown }).statusMessage;
    if (typeof statusMessage === "string") {
      return statusMessage;
    }
  }
  return err instanceof Error ? err.message : "Failed to add feed";
}

// Sequential by design: each add already carries its own internal validation
// timeout (see feedCreation.ts). Rather than trusting that timeout alone to
// keep the whole request within budget, this tracks cumulative elapsed time
// and stops starting new adds once IMPORT_TIME_BUDGET_MS is spent, folding
// whatever is left into truncatedCount instead of hanging the request.
async function importEntries(
  userId: number,
  entries: ReturnType<typeof parseOpml>["entries"],
): Promise<Omit<ImportResult, "truncatedCount">> {
  const imported: CreatedFeed[] = [];
  const skipped: SkippedEntry[] = [];
  const startedAt = Date.now();

  for (const entry of entries) {
    if (Date.now() - startedAt > IMPORT_TIME_BUDGET_MS) {
      break;
    }

    try {
      const feed = await createFeedForUser(userId, entry.xmlUrl);
      imported.push(feed);
    } catch (err) {
      skipped.push({
        url: entry.xmlUrl,
        title: entry.title,
        reason: reasonFromError(err),
      });
    }
  }

  return { imported, skipped };
}

export default defineEventHandler(async (event): Promise<ImportResult> => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ opml?: string }>(event);
  if (!body?.opml?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "OPML file content is required",
    });
  }

  let parsed: ReturnType<typeof parseOpml>;
  try {
    parsed = parseOpml(body.opml);
  } catch (err) {
    if (err instanceof OpmlParseError) {
      throw createError({ statusCode: 400, statusMessage: err.message });
    }
    throw err;
  }

  const { imported, skipped } = await importEntries(user.id, parsed.entries);
  const attemptedCount = imported.length + skipped.length;
  const timeBudgetTruncated = attemptedCount < parsed.entries.length;

  return {
    imported,
    skipped,
    truncatedCount:
      parsed.truncatedCount +
      (timeBudgetTruncated ? parsed.entries.length - attemptedCount : 0),
  };
});
