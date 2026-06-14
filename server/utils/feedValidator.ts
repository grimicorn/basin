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

// Hosts explicitly allowed for local development and e2e testing only.
// Set NUXT_FEED_DISCOVERY_ALLOWED_HOSTS to a comma-separated list of
// host:port strings (e.g. "127.0.0.1:3099") to bypass the protocol and
// private-IP checks so mock servers can be used during e2e tests.
function allowedTestHosts(): Set<string> {
  const raw = process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS ?? "";
  const hosts = raw
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return new Set(hosts);
}

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

  const hostWithPort = parsed.port
    ? `${parsed.hostname}:${parsed.port}`
    : parsed.hostname;

  if (allowedTestHosts().has(hostWithPort)) return true;

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  if (PRIVATE_IP_PATTERN.test(parsed.hostname)) return false;

  return true;
}

function resolveRedirectUrl(
  location: string | null,
  targetUrl: string,
): string {
  if (!location) {
    throw new Error("Redirect response missing Location header");
  }
  return new URL(location, targetUrl).toString();
}

function assertRedirectAllowed(
  redirectUrl: string,
  redirectsRemaining: number,
): void {
  if (!isAllowedUrl(redirectUrl)) {
    throw new Error("Feed redirect target is not allowed");
  }
  if (redirectsRemaining <= 0) {
    throw new Error("Too many redirects");
  }
}

async function readBodyChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array[]> {
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

  return chunks;
}

function mergeChunks(chunks: Uint8Array[]): string {
  const merged = chunks.reduce((accumulated, chunk) => {
    const combined = new Uint8Array(accumulated.length + chunk.length);
    combined.set(accumulated, 0);
    combined.set(chunk, accumulated.length);
    return combined;
  }, new Uint8Array(0));

  return new TextDecoder().decode(merged);
}

async function readResponseBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const chunks = await readBodyChunks(reader);
  return mergeChunks(chunks);
}

export async function fetchFeedBody(
  url: string,
  fetchImpl: typeof fetch = fetch,
  redirectsRemaining: number = MAX_REDIRECTS,
): Promise<string> {
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

    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = resolveRedirectUrl(
        response.headers.get("location"),
        targetUrl,
      );
      assertRedirectAllowed(redirectUrl, redirectsRemaining);
      clearTimeout(timeoutId);
      return await fetchFeedBody(
        redirectUrl,
        fetchImpl,
        redirectsRemaining - 1,
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Feed server responded with status ${response.status}`);
    }

    return await readResponseBody(response);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function validateFeedContent(
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
