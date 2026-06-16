import { feeds } from "../db/schema";
import {
  fetchFeedBody,
  looksLikeValidFeed,
  buildProxyFetch,
} from "../utils/feedValidator";
import {
  detectFeedSourceType,
  type FeedSourceType,
} from "../utils/feedTypeDetector";

const VALID_SOURCE_TYPES: ReadonlySet<FeedSourceType> = new Set([
  "rss",
  "podcast",
]);

function isValidSourceType(value: unknown): value is FeedSourceType {
  return (
    typeof value === "string" && VALID_SOURCE_TYPES.has(value as FeedSourceType)
  );
}

// fetchFeedBody manages its own internal AbortController and timeout.
// Passing buildProxyFetch() as fetchImpl allows that internal signal to reach
// the real fetch() call so both the proxy path and the timeout work correctly.
async function fetchAndValidateFeed(url: string): Promise<string> {
  return fetchFeedBody(url, buildProxyFetch());
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const body = await readBody<{ url: string; sourceOverride?: string }>(event);
  const rawUrl = body?.url;
  if (!rawUrl?.trim())
    throw createError({ statusCode: 400, statusMessage: "URL is required" });

  const trimmedUrl = rawUrl.trim();

  if (
    body.sourceOverride !== undefined &&
    !isValidSourceType(body.sourceOverride)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid sourceOverride — must be one of: ${[...VALID_SOURCE_TYPES].join(", ")}`,
    });
  }

  let feedBody: string;
  try {
    feedBody = await fetchAndValidateFeed(trimmedUrl);
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    throw createError({
      statusCode: isTimeout ? 504 : 422,
      statusMessage: isTimeout
        ? "Feed validation timed out"
        : "URL does not point to a valid RSS or Atom feed",
    });
  }

  if (!looksLikeValidFeed(feedBody))
    throw createError({
      statusCode: 422,
      statusMessage: "URL does not point to a valid RSS or Atom feed",
    });

  const detectedSource = detectFeedSourceType(feedBody);
  const source = body.sourceOverride ?? detectedSource;

  const [feed] = await useDb()
    .insert(feeds)
    .values({
      userId: user.id,
      url: trimmedUrl,
      source,
    })
    .returning();

  return { ...feed, detectedSource };
});
