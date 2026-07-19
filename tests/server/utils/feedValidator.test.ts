import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as dnsModule from "dns";
import {
  looksLikeValidFeed,
  fetchFeedBody,
  validateFeedContent,
} from "../../../server/utils/feedValidator";

// isAllowedUrl (feedValidator's internal SSRF guard) now delegates to the
// DNS-resolving urlValidator, so every "allowed" URL below needs a mocked DNS
// resolution to a public address. Mirrors the mocking style in
// urlValidator.test.ts.
const mockResolve4 = vi.spyOn(dnsModule.promises, "resolve4");
const mockResolve6 = vi.spyOn(dnsModule.promises, "resolve6");

beforeEach(() => {
  mockResolve4.mockReset();
  mockResolve6.mockReset();
  mockResolve4.mockResolvedValue(["93.184.216.34"]);
  mockResolve6.mockRejectedValue(new Error("ENODATA"));
});

function makeMockFetch(body: string, status = 200) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });

  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    text: () => Promise.resolve(body),
  });
}

function makeMockFetchWithRedirect(redirectUrl: string, finalBody: string) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(finalBody);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });

  return vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      status: 301,
      headers: {
        get: (name: string) => (name === "location" ? redirectUrl : null),
      },
      body: null,
      text: () => Promise.resolve(""),
    })
    .mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
      text: () => Promise.resolve(finalBody),
    });
}

describe("looksLikeValidFeed", () => {
  it("returns true for an RSS 2.0 document", () => {
    const body = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
    expect(looksLikeValidFeed(body)).toBe(true);
  });

  it("returns true for an Atom feed document", () => {
    const body = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`;
    expect(looksLikeValidFeed(body)).toBe(true);
  });

  it("returns true for an RDF/RSS 1.0 document", () => {
    const body = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF>`;
    expect(looksLikeValidFeed(body)).toBe(true);
  });

  it("returns false for a plain HTML page", () => {
    const body = `<!DOCTYPE html><html><head><title>Not a feed</title></head><body></body></html>`;
    expect(looksLikeValidFeed(body)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(looksLikeValidFeed("")).toBe(false);
  });

  it("returns false for arbitrary JSON", () => {
    const body = JSON.stringify({ items: [{ title: "Post" }] });
    expect(looksLikeValidFeed(body)).toBe(false);
  });

  it("returns false when feed tag appears deep inside an HTML body", () => {
    const body = `<!DOCTYPE html><html><body><div class="rss">not a feed</div></body></html>`;
    expect(looksLikeValidFeed(body)).toBe(false);
  });
});

describe("fetchFeedBody", () => {
  afterEach(() => {
    // clearAllMocks (not restoreAllMocks) here: restoreAllMocks would also
    // un-spy the module-level dns.promises.resolve4/resolve6 mocks set up
    // above, which the top-level beforeEach relies on staying spied for
    // every test in this file (isAllowedUrl now resolves DNS).
    vi.clearAllMocks();
  });

  it("fetches the URL and returns the response text", async () => {
    const mockFetch = makeMockFetch("<rss version='2.0'/>");

    const body = await fetchFeedBody(
      "https://example.com/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(body).toBe("<rss version='2.0'/>");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/feed.xml",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("propagates fetch errors to the caller", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new Error("Network unreachable"));

    await expect(
      fetchFeedBody(
        "https://example.com/feed.xml",
        mockFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow("Network unreachable");
  });

  it("throws when the server returns a non-2xx response", async () => {
    const mockFetch = makeMockFetch("Not Found", 404);

    await expect(
      fetchFeedBody(
        "https://example.com/missing.xml",
        mockFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow("Feed server responded with status 404");
  });

  it("follows a redirect and returns the final body", async () => {
    const feedBody = `<?xml version="1.0"?><rss version="2.0"/>`;
    const mockFetch = makeMockFetchWithRedirect(
      "https://redirected.example.com/feed.xml",
      feedBody,
    );

    const body = await fetchFeedBody(
      "https://example.com/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(body).toBe(feedBody);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws when too many redirects occur", async () => {
    const alwaysRedirectFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 301,
      headers: {
        get: (name: string) =>
          name === "location" ? "https://example.com/other.xml" : null,
      },
      body: null,
      text: () => Promise.resolve(""),
    });

    await expect(
      fetchFeedBody(
        "https://example.com/feed.xml",
        alwaysRedirectFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow("Too many redirects");
  });

  it("throws when the redirect Location header is missing", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 301,
      headers: { get: () => null },
      body: null,
      text: () => Promise.resolve(""),
    });

    await expect(
      fetchFeedBody(
        "https://example.com/feed.xml",
        mockFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow("Redirect response missing Location header");
  });

  it("throws when the redirect target is a private URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 301,
      headers: {
        get: (name: string) =>
          name === "location" ? "https://192.168.1.1/feed.xml" : null,
      },
      body: null,
      text: () => Promise.resolve(""),
    });

    await expect(
      fetchFeedBody(
        "https://example.com/feed.xml",
        mockFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow("Feed redirect target is not allowed");
  });

  it("uses FEED_FETCH_PROXY_URL to override the target URL when set", async () => {
    const originalProxyUrl = process.env.FEED_FETCH_PROXY_URL;
    process.env.FEED_FETCH_PROXY_URL = "http://localhost:3099/feed-proxy";

    try {
      // Re-import to pick up the updated env var
      const { fetchFeedBody: freshFetchFeedBody } = await import(
        "../../../server/utils/feedValidator?cachebust=" + Date.now()
      );

      const mockFetch = makeMockFetch("<rss version='2.0'/>");

      await freshFetchFeedBody(
        "https://example.com/feed.xml",
        mockFetch as unknown as typeof fetch,
      );

      const calledUrl: string = mockFetch.mock.calls[0][0];
      const parsed = new URL(calledUrl);
      expect(parsed.pathname).toBe("/feed-proxy");
      expect(parsed.searchParams.get("url")).toBe(
        "https://example.com/feed.xml",
      );
    } finally {
      if (originalProxyUrl === undefined) {
        delete process.env.FEED_FETCH_PROXY_URL;
      } else {
        process.env.FEED_FETCH_PROXY_URL = originalProxyUrl;
      }
    }
  });
});

describe("validateFeedContent", () => {
  it("returns true when the URL resolves to a valid RSS feed", async () => {
    const rssBody = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
    const mockFetch = makeMockFetch(rssBody);

    const result = await validateFeedContent(
      "https://example.com/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(true);
  });

  it("returns true when the URL resolves to a valid Atom feed", async () => {
    const atomBody = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`;
    const mockFetch = makeMockFetch(atomBody);

    const result = await validateFeedContent(
      "https://example.com/atom.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(true);
  });

  it("returns false when the URL resolves to a non-feed HTML page", async () => {
    const htmlBody = `<!DOCTYPE html><html><body><p>Not a feed</p></body></html>`;
    const mockFetch = makeMockFetch(htmlBody);

    const result = await validateFeedContent(
      "https://example.com/",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
  });

  it("returns false when the fetch throws a network error", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new Error("Network unreachable"));

    const result = await validateFeedContent(
      "https://unreachable.example.com/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
  });

  it("returns false when the server returns an empty body", async () => {
    const mockFetch = makeMockFetch("");

    const result = await validateFeedContent(
      "https://example.com/404",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
  });

  it("returns false for private/loopback URLs", async () => {
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "http://127.0.0.1/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for a hostname that DNS-resolves to a private IP", async () => {
    // A regex over the literal hostname can never catch this: the domain
    // itself isn't a blocked literal, but DNS resolves it to an internal
    // address. isAllowedUrl now delegates to the DNS-resolving urlValidator
    // (shared with feed discovery) instead of a hostname-only regex, so this
    // is caught on add.
    mockResolve4.mockResolvedValueOnce(["192.168.5.10"]);
    mockResolve6.mockRejectedValueOnce(new Error("ENODATA"));
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "https://internal.example.com/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns true for hosts in NUXT_FEED_DISCOVERY_ALLOWED_HOSTS (e2e override)", async () => {
    const originalAllowedHosts = process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS;
    process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS = "127.0.0.1:3099";

    try {
      const { validateFeedContent: freshValidateFeedUrl } = await import(
        "../../../server/utils/feedValidator?cachebust=" + Date.now()
      );

      const feedBody = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
      const mockFetch = makeMockFetch(feedBody);

      const result = await freshValidateFeedUrl(
        "http://127.0.0.1:3099/feed.xml",
        mockFetch as unknown as typeof fetch,
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    } finally {
      if (originalAllowedHosts === undefined) {
        delete process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS;
      } else {
        process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS = originalAllowedHosts;
      }
    }
  });

  it("returns false for localhost hostname", async () => {
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "https://localhost/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for 0.0.0.0 address", async () => {
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "https://0.0.0.0/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for IPv6-mapped IPv4 addresses (::ffff:)", async () => {
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "https://[::ffff:192.168.1.1]/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for IPv6 loopback address (::1)", async () => {
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "https://[::1]/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for IPv6 ULA addresses (fc00::/7)", async () => {
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "https://[fc00::1]/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not block legitimate domains that start with fc or fd", async () => {
    const feedBody = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
    const mockFetch = makeMockFetch(feedBody);

    const result = await validateFeedContent(
      "https://fdroid.org/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("returns false for non-http/https URLs", async () => {
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "file:///etc/passwd",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for a plain http:// URL (feed add/validation requires https)", async () => {
    // Pins pre-existing behavior: unlike discovery and sync (which also
    // accept http via resolvePublicFeedUrl directly), feed content fetches
    // require https. Consolidating onto the shared DNS-resolving validator
    // must not silently loosen this.
    const mockFetch = vi.fn();

    const result = await validateFeedContent(
      "http://example.com/feed.xml",
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("re-throws AbortError so the caller can emit a 504 timeout response", async () => {
    const abortError = new DOMException(
      "The operation was aborted",
      "AbortError",
    );
    const mockFetch = vi.fn().mockRejectedValue(abortError);

    await expect(
      validateFeedContent(
        "https://slow.example.com/feed.xml",
        mockFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow(abortError);
  });
});
