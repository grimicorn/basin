// Configurable so tests can point feed fetches at a local mock server.
// When FEED_FETCH_PROXY_URL is set the original URL is forwarded as the
// `url` query parameter so the mock can return a canned response without
// making real network requests.
export const FEED_FETCH_PROXY_URL = process.env.FEED_FETCH_PROXY_URL ?? "";

const FEED_FETCH_TIMEOUT_MS = 8_000;
const MAX_FEED_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REDIRECTS = 5;

// Anchored to the start of the document so an HTML page embedding one of
// these tags in its body does not pass as a valid feed.
const RSS_ATOM_PATTERN = /^(\s*<\?xml[^?]*\?>\s*)?<(rss|feed|rdf:RDF)[^>]*>/i;

// IPv6 hostnames from the URL API are always bracket-wrapped: [::1], [fc00::1], etc.
const PRIVATE_IP_PATTERN =
  /^(localhost$|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|\[::1\]|\[::ffff:|\[fc[\da-f]{2}:|\[fd[\da-f]{2}:)/i;

const ALLOWED_PROTOCOLS = new Set(["https:"]);

export function looksLikeValidFeed(body: string): boolean {
  return RSS_ATOM_PATTERN.test(body);
}

function resolveTargetUrl(url: string): string {
  if (!FEED_FETCH_PROXY_URL) return url;
  const proxyUrl = new URL(FEED_FETCH_PROXY_URL);
  proxyUrl.searchParams.set("url", url);
  return proxyUrl.toString();
}

function isAllowedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  if (PRIVATE_IP_PATTERN.test(parsed.hostname)) return false;

  return true;
}

export async function fetchFeedBody(
  url: string,
  fetchImpl: typeof fetch = fetch,
  redirectsRemaining: number = MAX_REDIRECTS,
): Promise<string> {
  // Validate the original URL before any proxy resolution
  if (!isAllowedUrl(url)) {
    throw new Error("Feed URL is not allowed");
  }

  const targetUrl = resolveTargetUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(targetUrl, {
      signal: controller.signal,
      redirect: "manual",
    });

    // Handle redirects manually to validate each hop
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect response missing Location header");
      }

      // Resolve relative redirects against the target URL
      const redirectUrl = new URL(location, targetUrl).toString();

      // Validate the redirect target against the original URL rules
      if (!isAllowedUrl(redirectUrl)) {
        throw new Error("Feed redirect target is not allowed");
      }

      if (redirectsRemaining <= 0) {
        throw new Error("Too many redirects");
      }

      // Follow the redirect by recursively calling fetchFeedBody
      clearTimeout(timeoutId);
      return await fetchFeedBody(redirectUrl, fetchImpl, redirectsRemaining - 1);
    }

    // Only accept 2xx status codes
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Feed server responded with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_FEED_BODY_BYTES) {
        reader.cancel();
        throw new Error("Feed response exceeded maximum allowed size");
      }
      chunks.push(value);
    }

    return new TextDecoder().decode(
      chunks.reduce((merged, chunk) => {
        const combined = new Uint8Array(merged.length + chunk.length);
        combined.set(merged, 0);
        combined.set(chunk, merged.length);
        return combined;
      }, new Uint8Array(0)),
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function validateFeedUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!isAllowedUrl(url)) return false;

  try {
    const body = await fetchFeedBody(url, fetchImpl);
    return looksLikeValidFeed(body);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return false;
  }
}
