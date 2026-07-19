// The single-feed add path: validates a URL is a real RSS/Atom feed (SSRF-safe
// fetch, size/redirect limits — see feedValidator.ts), detects rss vs podcast,
// and upserts it for the user (deduped on the feeds_user_id_url_idx unique
// index). Both POST /api/feeds and the OPML import route call this so the
// two entry points can never drift on validation or dedupe behavior.
import { feeds } from "../db/schema";
import { fetchFeedBody, validateFeedContent } from "./feedValidator";
import { detectFeedSource } from "./feedSourceDetector";

const FEED_VALIDATION_TIMEOUT_MS = 10_000;

export type FeedSource = "rss" | "podcast";

export interface CreatedFeed {
  id: number;
  userId: number;
  url: string;
  title: string | null;
  source: string;
  sourceOverride: string | null;
  detectedSource: FeedSource;
}

async function fetchAndDetectSource(
  url: string,
  fetchImpl: typeof fetch,
): Promise<FeedSource> {
  const body = await fetchFeedBody(url, fetchImpl);
  return detectFeedSource(body);
}

async function validateWithTimeout(url: string): Promise<FeedSource> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    FEED_VALIDATION_TIMEOUT_MS,
  );

  const boundFetch = (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => fetch(input, { ...init, signal: controller.signal });

  try {
    const isValid = await validateFeedContent(url, boundFetch as typeof fetch);

    if (!isValid) {
      throw createError({
        statusCode: 422,
        statusMessage: "URL does not point to a valid RSS or Atom feed",
      });
    }

    return await fetchAndDetectSource(url, boundFetch as typeof fetch);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validates and adds a single feed for a user, reusing the exact SSRF
 * validation and dedupe rules the single-feed add form uses. Throws an h3
 * error (with statusCode) on validation/timeout failure — callers that need
 * to continue past a single bad URL (e.g. OPML import) must catch per call.
 */
export async function createFeedForUser(
  userId: number,
  url: string,
  sourceOverride?: FeedSource,
): Promise<CreatedFeed> {
  let detectedSource: FeedSource;
  try {
    detectedSource = await validateWithTimeout(url);
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isAbort) {
      throw createError({
        statusCode: 504,
        statusMessage: "Feed validation timed out",
      });
    }
    throw err;
  }

  const resolvedSource = sourceOverride ?? detectedSource;

  const [feed] = await useDb()
    .insert(feeds)
    .values({
      userId,
      url,
      source: resolvedSource,
      sourceOverride: sourceOverride ?? null,
    })
    .onConflictDoUpdate({
      target: [feeds.userId, feeds.url],
      set: { source: resolvedSource, sourceOverride: sourceOverride ?? null },
    })
    .returning();

  return { ...feed, detectedSource } as CreatedFeed;
}
