// Feed content types that identify a document as a valid RSS or Atom feed.
const FEED_CONTENT_TYPES = [
  "application/rss+xml",
  "application/atom+xml",
  "application/feed+json",
  "text/xml",
  "application/xml",
];

// Common feed paths to probe when link-tag discovery finds nothing.
const COMMON_FEED_PATHS = [
  "/feed",
  "/feed.xml",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/feeds/all.atom.xml",
];

export type FetchFn = (
  _url: string,
  _init?: Record<string, unknown>,
) => Promise<Pick<Response, "ok" | "headers" | "text">>;

function isFeedContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return FEED_CONTENT_TYPES.some((type) => normalized.includes(type));
}

async function fetchWithHead(
  fetchFn: FetchFn,
  url: string,
): Promise<Response | null> {
  try {
    const response = await fetchFn(url, {
      headers: { "User-Agent": "FeedDiscovery/1.0" },
    });
    if (!response.ok) return null;
    return response as Response;
  } catch {
    return null;
  }
}

function extractFeedUrlFromHtml(html: string, baseUrl: string): string | null {
  const linkTagPattern =
    /<link[^>]+type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const hrefFirstPattern =
    /<link[^>]+href=["']([^"']+)["'][^>]+type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*>/gi;

  const match = linkTagPattern.exec(html) ?? hrefFirstPattern.exec(html);
  if (!match) return null;

  const href = linkTagPattern.lastIndex > 0 ? match[2] : match[1];
  if (!href) return null;

  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

async function probeCommonFeedPaths(
  fetchFn: FetchFn,
  baseUrl: string,
): Promise<string | null> {
  const origin = new URL(baseUrl).origin;

  for (const path of COMMON_FEED_PATHS) {
    const candidateUrl = `${origin}${path}`;
    const response = await fetchWithHead(fetchFn, candidateUrl);
    if (!response) continue;

    const contentType = response.headers.get("content-type") ?? "";
    if (isFeedContentType(contentType)) return candidateUrl;

    const body = await response.text();
    if (
      body.trimStart().startsWith("<?xml") ||
      body.includes("<rss") ||
      body.includes("<feed")
    ) {
      return candidateUrl;
    }
  }

  return null;
}

export async function discoverFeedUrl(
  inputUrl: string,
  fetchFn: FetchFn = fetch,
): Promise<string | null> {
  const response = await fetchWithHead(fetchFn, inputUrl);
  if (!response) return null;

  const contentType = response.headers.get("content-type") ?? "";

  if (isFeedContentType(contentType)) return inputUrl;

  const body = await response.text();

  if (
    body.trimStart().startsWith("<?xml") ||
    body.includes("<rss") ||
    body.includes("<feed xmlns")
  ) {
    return inputUrl;
  }

  const discoveredFromHtml = extractFeedUrlFromHtml(body, inputUrl);
  if (discoveredFromHtml) return discoveredFromHtml;

  return probeCommonFeedPaths(fetchFn, inputUrl);
}
