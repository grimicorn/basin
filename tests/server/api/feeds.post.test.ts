import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

vi.stubGlobal("useDb", () => ({ insert: mockInsert }));

vi.mock("../../../server/utils/feedValidator", () => ({
  fetchFeedBody: vi.fn(),
  looksLikeValidFeed: vi.fn(),
  FEED_FETCH_PROXY_URL: "",
}));

vi.mock("../../../server/utils/feedTypeDetector", () => ({
  detectFeedSourceType: vi.fn(),
}));

import handler from "../../../server/api/feeds.post";
import {
  fetchFeedBody,
  looksLikeValidFeed,
} from "../../../server/utils/feedValidator";
import { detectFeedSourceType } from "../../../server/utils/feedTypeDetector";

const mockFetchFeedBody = vi.mocked(fetchFeedBody);
const mockLooksLikeValidFeed = vi.mocked(looksLikeValidFeed);
const mockDetectFeedSourceType = vi.mocked(detectFeedSourceType);

const RSS_BODY = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;

const mockFeed = {
  id: 1,
  url: "https://example.com/feed.xml",
  source: "rss",
  userId: 1,
  detectedSource: "rss",
};

describe("POST /api/feeds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    // Default to a valid feed so existing tests don't need to care about validation
    mockFetchFeedBody.mockResolvedValue(RSS_BODY);
    mockLooksLikeValidFeed.mockReturnValue(true);
    mockDetectFeedSourceType.mockReturnValue("rss");
  });

  it("throws 401 when unauthenticated", async () => {
    const event = {
      context: { user: null },
      body: { url: "https://example.com/feed.xml" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when URL is missing", async () => {
    const event = { context: { user: { id: 1 } }, body: {} };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when URL is blank", async () => {
    const event = { context: { user: { id: 1 } }, body: { url: "   " } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 422 when the URL does not point to a valid feed", async () => {
    mockLooksLikeValidFeed.mockReturnValue(false);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/not-a-feed" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("throws 422 when fetching the feed body fails", async () => {
    mockFetchFeedBody.mockRejectedValue(new Error("Network error"));
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/not-a-feed" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("throws 504 when fetching the feed body times out", async () => {
    const abortError = Object.assign(
      new DOMException("The operation was aborted", "AbortError"),
    );
    mockFetchFeedBody.mockRejectedValue(abortError);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/slow" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 504 });
  });

  it("does not insert the feed when validation fails", async () => {
    mockLooksLikeValidFeed.mockReturnValue(false);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/not-a-feed" },
    };
    await expect(handler(event)).rejects.toBeDefined();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts the feed and returns it with detectedSource", async () => {
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    const result = await handler(event);
    expect(result).toMatchObject({
      id: 1,
      url: "https://example.com/feed.xml",
      detectedSource: "rss",
    });
  });

  it("uses the detected source from feed content for a plain rss feed", async () => {
    mockDetectFeedSourceType.mockReturnValue("rss");
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: "rss" }),
    );
  });

  it("uses the detected source from feed content for a podcast feed", async () => {
    mockDetectFeedSourceType.mockReturnValue("podcast");
    const podFeed = {
      ...mockFeed,
      source: "podcast",
      detectedSource: "podcast",
    };
    mockReturning.mockResolvedValue([podFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: "podcast" }),
    );
  });

  it("uses sourceOverride when provided", async () => {
    mockDetectFeedSourceType.mockReturnValue("rss");
    const overrideFeed = { ...mockFeed, source: "podcast" };
    mockReturning.mockResolvedValue([overrideFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml", sourceOverride: "podcast" },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: "podcast" }),
    );
  });

  it("trims whitespace from the URL before inserting", async () => {
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "  https://example.com/feed.xml  " },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/feed.xml" }),
    );
  });
});
