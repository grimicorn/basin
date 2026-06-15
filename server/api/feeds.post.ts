import { feeds } from "../db/schema";
import {
  fetchFeedBody,
  looksLikeValidFeed,
  FEED_FETCH_PROXY_URL,
} from "../utils/feedValidator";
import { detectFeedSourceType } from "../utils/feedTypeDetector";

const FEED_VALIDATION_TIMEOUT_MS = 10_000;

function buildFetchWithTimeout(): {
  fetchImpl: typeof fetch;
  clearTimer: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    FEED_VALIDATION_TIMEOUT_MS,
  );

  const fetchImpl = (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => fetch(input, { ...init, signal: controller.signal });

  return {
    fetchImpl: fetchImpl as typeof fetch,
    clearTimer: () => clearTimeout(timeoutId),
  };
}

// When FEED_FETCH_PROXY_URL is set, route validation fetches through the proxy
// so e2e tests never make direct outbound HTTP requests.
function buildProxyAwareFetch(baseFetch: typeof fetch): typeof fetch {
  if (!FEED_FETCH_PROXY_URL) return baseFetch;
  return ((input: string, init?: Parameters<typeof fetch>[1]) => {
    const proxyUrl = new URL(FEED_FETCH_PROXY_URL);
    proxyUrl.searchParams.set("url", input);
    return baseFetch(proxyUrl.toString(), init);
  }) as typeof fetch;
}

async function fetchAndValidateFeed(url: string): Promise<string> {
  const { fetchImpl, clearTimer } = buildFetchWithTimeout();
  const proxyFetch = buildProxyAwareFetch(fetchImpl);

  try {
    return await fetchFeedBody(url, proxyFetch);
  } finally {
    clearTimer();
  }
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
