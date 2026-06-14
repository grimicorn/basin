import { discoverFeedUrl, type FetchFn } from "../../utils/feedDiscovery";
import { validateFeedUrl } from "../../utils/urlValidator";
import { FEED_FETCH_PROXY_URL } from "../../utils/feedValidator";

function parseUrlFromBody(body: unknown): string {
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as Record<string, unknown>).url !== "string" ||
    !(body as { url: string }).url.trim()
  ) {
    throw createError({ statusCode: 400, statusMessage: "URL is required" });
  }
  return (body as { url: string }).url.trim();
}

// When FEED_FETCH_PROXY_URL is set, route discovery fetches through the proxy
// so e2e tests never make direct outbound HTTP requests. The proxy receives the
// original URL as a query parameter and returns a canned response.
function buildDiscoveryFetch(): FetchFn {
  if (!FEED_FETCH_PROXY_URL) return fetch as unknown as FetchFn;
  return (url: string, init?: Record<string, unknown>) => {
    const proxyUrl = new URL(FEED_FETCH_PROXY_URL);
    proxyUrl.searchParams.set("url", url);
    return fetch(
      proxyUrl.toString(),
      init as Parameters<typeof fetch>[1],
    ) as Promise<Pick<Response, "ok" | "headers" | "text">>;
  };
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const url = parseUrlFromBody(await readBody(event));
  const validatedUrl = await validateFeedUrl(url);

  const feedUrl = await discoverFeedUrl(validatedUrl, buildDiscoveryFetch());
  if (!feedUrl)
    throw createError({
      statusCode: 422,
      statusMessage: "No feed found at the given URL",
    });

  return { feedUrl };
});
