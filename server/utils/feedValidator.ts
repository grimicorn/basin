// Configurable so tests can point feed fetches at a local mock server.
// When FEED_FETCH_PROXY_URL is set the original URL is forwarded as the
// `url` query parameter so the mock can return a canned response without
// making real network requests.
export const FEED_FETCH_PROXY_URL = process.env.FEED_FETCH_PROXY_URL ?? "";

const FEED_FETCH_TIMEOUT_MS = 8_000;
const MAX_FEED_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

// Anchored to the start of the document so an HTML page embedding one of
// these tags in its body does not pass as a valid feed.
const RSS_ATOM_PATTERN = /^(\s*<\?xml[^?]*\?>\s*)?<(rss|feed|rdf:RDF)[^>]*>/i;

const PRIVATE_IP_PATTERN =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|fc|fd)/i;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

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
): Promise<string> {
  const targetUrl = resolveTargetUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(targetUrl, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Feed server responded with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return await response.text();

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
  if (!FEED_FETCH_PROXY_URL && !isAllowedUrl(url)) return false;

  try {
    const body = await fetchFeedBody(url, fetchImpl);
    return looksLikeValidFeed(body);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return false;
  }
}
