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
  buildProxyFetch: vi.fn().mockReturnValue(fetch),
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
  buildProxyFetch,
} from "../../../../server/utils/feedValidator";
import { detectFeedSourceType } from "../../../../server/utils/feedTypeDetector";

const mockDiscoverFeedUrl = vi.mocked(discoverFeedUrl);
const mockValidateFeedUrl = vi.mocked(validateFeedUrl);
const mockFetchFeedBody = vi.mocked(fetchFeedBody);
const mockLooksLikeValidFeed = vi.mocked(looksLikeValidFeed);
const mockDetectFeedSourceType = vi.mocked(detectFeedSourceType);
const mockBuildProxyFetch = vi.mocked(buildProxyFetch);

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
    mockBuildProxyFetch.mockReturnValue(fetch);
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

  it("passes a fetch function to discoverFeedUrl", async () => {
    let capturedFetchFn: unknown;
    mockDiscoverFeedUrl.mockImplementation(
      (_url: string, fetchFn?: unknown) => {
        capturedFetchFn = fetchFn;
        return Promise.resolve("https://example.com/feed.xml");
      },
    );

    await handler(makeEvent({ id: 1 }, { url: "https://example.com" }));

    expect(typeof capturedFetchFn).toBe("function");
  });

  it("passes the buildProxyFetch result to fetchFeedBody for source detection", async () => {
    const proxyFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream(),
      headers: { get: () => null },
    });
    mockBuildProxyFetch.mockReturnValue(proxyFetch as unknown as typeof fetch);
    mockDiscoverFeedUrl.mockResolvedValue("https://example.com/feed.xml");

    await handler(makeEvent({ id: 1 }, { url: "https://example.com" }));

    expect(mockFetchFeedBody).toHaveBeenCalledWith(
      "https://example.com/feed.xml",
      proxyFetch,
    );
  });
});
