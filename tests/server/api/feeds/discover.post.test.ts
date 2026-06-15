import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("../../../../server/utils/feedDiscovery", () => ({
  discoverFeedUrl: vi.fn(),
}));

vi.mock("../../../../server/utils/urlValidator", () => ({
  validateFeedUrl: vi.fn(),
}));

vi.mock("../../../../server/utils/feedValidator", () => ({
  fetchFeedBody: vi.fn(),
  looksLikeValidFeed: vi.fn(),
  FEED_FETCH_PROXY_URL: "",
}));

vi.mock("../../../../server/utils/feedTypeDetector", () => ({
  detectFeedSourceType: vi.fn(),
}));

import handler from "../../../../server/api/feeds/discover.post";
import { discoverFeedUrl } from "../../../../server/utils/feedDiscovery";
import { validateFeedUrl } from "../../../../server/utils/urlValidator";
import {
  fetchFeedBody,
  looksLikeValidFeed,
} from "../../../../server/utils/feedValidator";
import { detectFeedSourceType } from "../../../../server/utils/feedTypeDetector";

const mockDiscoverFeedUrl = vi.mocked(discoverFeedUrl);
const mockValidateFeedUrl = vi.mocked(validateFeedUrl);
const mockFetchFeedBody = vi.mocked(fetchFeedBody);
const mockLooksLikeValidFeed = vi.mocked(looksLikeValidFeed);
const mockDetectFeedSourceType = vi.mocked(detectFeedSourceType);

const RSS_BODY = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;

// The default readBody stub in tests/setup.ts resolves event.body.
// Override it per test when we need non-standard body shapes.
const defaultReadBody = globalThis.readBody;

function makeEvent(user: unknown = { id: 1 }, body: unknown = {}) {
  return { context: { user }, body };
}

describe("POST /api/feeds/discover", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.readBody = defaultReadBody;
    mockValidateFeedUrl.mockImplementation((url: string) =>
      Promise.resolve(url),
    );
    mockFetchFeedBody.mockResolvedValue(RSS_BODY);
    mockLooksLikeValidFeed.mockReturnValue(true);
    mockDetectFeedSourceType.mockReturnValue("rss");
  });

  afterEach(() => {
    globalThis.readBody = defaultReadBody;
  });

  it("throws 401 when unauthenticated", async () => {
    const event = makeEvent(null, { url: "https://example.com" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when body is null", async () => {
    globalThis.readBody = () => Promise.resolve(null);
    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when body is not an object", async () => {
    globalThis.readBody = () => Promise.resolve("https://example.com");
    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when body.url is missing", async () => {
    const event = makeEvent({ id: 1 }, { notUrl: "foo" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body.url is not a string", async () => {
    const event = makeEvent({ id: 1 }, { url: 42 });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body.url is an empty string", async () => {
    const event = makeEvent({ id: 1 }, { url: "" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body.url is a whitespace-only string", async () => {
    const event = makeEvent({ id: 1 }, { url: "   " });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 422 when no feed is found at the URL", async () => {
    mockDiscoverFeedUrl.mockResolvedValue(null);
    const event = makeEvent({ id: 1 }, { url: "https://example.com" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("returns the discovered feed URL and detectedSource", async () => {
    mockDiscoverFeedUrl.mockResolvedValue("https://example.com/feed.xml");
    mockDetectFeedSourceType.mockReturnValue("rss");
    const result = await handler(
      makeEvent({ id: 1 }, { url: "https://example.com" }),
    );
    expect(result).toEqual({
      feedUrl: "https://example.com/feed.xml",
      detectedSource: "rss",
    });
  });

  it("returns detectedSource as podcast when feed content signals a podcast", async () => {
    mockDiscoverFeedUrl.mockResolvedValue("https://example.com/podcast.xml");
    mockDetectFeedSourceType.mockReturnValue("podcast");
    const result = await handler(
      makeEvent({ id: 1 }, { url: "https://example.com/podcast" }),
    );
    expect(result).toEqual({
      feedUrl: "https://example.com/podcast.xml",
      detectedSource: "podcast",
    });
  });

  it("returns detectedSource as rss when feed body fetch fails", async () => {
    mockDiscoverFeedUrl.mockResolvedValue("https://example.com/feed.xml");
    mockFetchFeedBody.mockRejectedValue(new Error("Network error"));
    const result = await handler(
      makeEvent({ id: 1 }, { url: "https://example.com" }),
    );
    expect(result).toEqual({
      feedUrl: "https://example.com/feed.xml",
      detectedSource: "rss",
    });
  });

  it("trims whitespace from the URL before validating", async () => {
    mockDiscoverFeedUrl.mockResolvedValue("https://example.com/feed.xml");
    await handler(makeEvent({ id: 1 }, { url: "  https://example.com  " }));
    expect(mockValidateFeedUrl).toHaveBeenCalledWith("https://example.com");
  });

  it("passes a proxy-aware fetch to discoverFeedUrl when FEED_FETCH_PROXY_URL is set", async () => {
    // Capture the fetchFn argument that the handler passes to discoverFeedUrl
    let capturedFetchFn: unknown;
    mockDiscoverFeedUrl.mockImplementation(
      (_url: string, fetchFn?: unknown) => {
        capturedFetchFn = fetchFn;
        return Promise.resolve("https://example.com/feed.xml");
      },
    );

    // Mock feedValidator's FEED_FETCH_PROXY_URL to simulate a test environment
    const feedValidatorModule =
      await import("../../../../server/utils/feedValidator");
    const originalProxyUrl = feedValidatorModule.FEED_FETCH_PROXY_URL;

    // Use vi.spyOn to temporarily override the exported constant
    vi.spyOn(
      feedValidatorModule,
      "FEED_FETCH_PROXY_URL",
      "get",
    ).mockReturnValue("http://127.0.0.1:3099/feed-proxy");

    try {
      await handler(makeEvent({ id: 1 }, { url: "https://example.com" }));

      // The captured fetch function should route requests through the proxy
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/rss+xml" },
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      await (capturedFetchFn as (_url: string) => Promise<unknown>)(
        "http://127.0.0.1:3099/feed.xml",
      );

      const calledUrl: string = mockFetch.mock.calls[0][0];
      const parsed = new URL(calledUrl);
      expect(parsed.pathname).toBe("/feed-proxy");
      expect(parsed.searchParams.get("url")).toBe(
        "http://127.0.0.1:3099/feed.xml",
      );
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      // Restore the original value check
      void originalProxyUrl;
    }
  });
});
