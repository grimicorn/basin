import { fetchFeedBody, FEED_FETCH_PROXY_URL } from "../../utils/feedValidator";
import { detectFeedSource } from "../../utils/feedSourceDetector";

const DETECT_TIMEOUT_MS = 10_000;

function buildDetectFetch(): typeof fetch {
  if (!FEED_FETCH_PROXY_URL) {
    return fetch;
  }

  return ((url: string, init?: Parameters<typeof fetch>[1]) => {
    const proxyUrl = new URL(FEED_FETCH_PROXY_URL);
    proxyUrl.searchParams.set("url", url);
    return fetch(proxyUrl.toString(), init);
  }) as typeof fetch;
}

async function fetchBodyWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DETECT_TIMEOUT_MS);

  const boundFetch = (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => fetchImpl(input, { ...init, signal: controller.signal });

  try {
    return await fetchFeedBody(url, boundFetch as typeof fetch);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ url: string }>(event);
  if (!body.url?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "URL is required" });
  }

  const feedUrl = body.url.trim();
  const fetchImpl = buildDetectFetch();

  let feedBody: string;
  try {
    feedBody = await fetchBodyWithTimeout(feedUrl, fetchImpl);
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isAbort) {
      throw createError({
        statusCode: 504,
        statusMessage: "Feed detection timed out",
      });
    }
    throw createError({
      statusCode: 422,
      statusMessage: "Could not fetch feed for type detection",
    });
  }

  const detectedSource = detectFeedSource(feedBody);
  return { detectedSource };
});
