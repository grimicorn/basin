import { createFeedForUser, type CreatedFeed } from "../../utils/feedCreation";
import { parseOpml, OpmlParseError } from "../../utils/opml";

interface SkippedEntry {
  url: string;
  title: string | null;
  reason: string;
}

interface ImportResult {
  imported: CreatedFeed[];
  skipped: SkippedEntry[];
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

// Sequential by design: each add already carries an internal validation
// timeout (see feedCreation.ts), and OPML files are capped to
// MAX_OPML_ENTRIES entries, so this stays well within a single request's
// execution budget without needing a concurrency limiter.
async function importEntries(
  userId: number,
  entries: ReturnType<typeof parseOpml>,
): Promise<ImportResult> {
  const imported: CreatedFeed[] = [];
  const skipped: SkippedEntry[] = [];

  for (const entry of entries) {
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

  let entries: ReturnType<typeof parseOpml>;
  try {
    entries = parseOpml(body.opml);
  } catch (err) {
    if (err instanceof OpmlParseError) {
      throw createError({ statusCode: 400, statusMessage: err.message });
    }
    throw err;
  }

  return importEntries(user.id, entries);
});
