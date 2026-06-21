import { feeds } from "../db/schema";
import { fetchFeedBody, validateFeedContent } from "../utils/feedValidator";
import { detectFeedSource } from "../utils/feedSourceDetector";

const FEED_VALIDATION_TIMEOUT_MS = 10_000;

type FeedSource = "rss" | "podcast";

async function fetchAndDetectSource(
  url: string,
  fetchImpl: typeof fetch,
): Promise<FeedSource> {
  const body = await fetchFeedBody(url, fetchImpl);
  return detectFeedSource(body);
}

async function validateWithTimeout(url: string): Promise<string> {
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

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ url: string; sourceOverride?: FeedSource }>(
    event,
  );
  const { sourceOverride } = body;

  if (
    sourceOverride !== undefined &&
    sourceOverride !== "rss" &&
    sourceOverride !== "podcast"
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid sourceOverride value",
    });
  }

  if (!body.url?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "URL is required" });
  }

  const trimmedUrl = body.url.trim();

  let detectedSource: FeedSource;
  try {
    detectedSource = await validateWithTimeout(trimmedUrl);
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
      userId: user.id,
      url: trimmedUrl,
      source: resolvedSource,
      sourceOverride: sourceOverride ?? null,
    })
    .onConflictDoUpdate({
      target: [feeds.userId, feeds.url],
      set: { source: resolvedSource, sourceOverride: sourceOverride ?? null },
    })
    .returning();

  return { ...feed, detectedSource };
});
