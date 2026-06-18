import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

vi.stubGlobal("useDb", () => ({ insert: mockInsert }));

vi.mock("../../../server/utils/feedValidator", () => ({
  validateFeedContent: vi.fn(),
  fetchFeedBody: vi.fn(),
  FEED_FETCH_PROXY_URL: "",
}));

vi.mock("../../../server/utils/feedSourceDetector", () => ({
  detectFeedSource: vi.fn(),
}));

import handler from "../../../server/api/feeds.post";
import {
  validateFeedContent,
  fetchFeedBody,
} from "../../../server/utils/feedValidator";
import { detectFeedSource } from "../../../server/utils/feedSourceDetector";

const mockValidateFeedContent = vi.mocked(validateFeedContent);
const mockFetchFeedBody = vi.mocked(fetchFeedBody);
const mockDetectFeedSource = vi.mocked(detectFeedSource);

const RSS_BODY = `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>`;

const mockFeed = {
  id: 1,
  url: "https://example.com/feed.xml",
  source: "rss",
  sourceOverride: null,
  userId: 1,
};

describe("POST /api/feeds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockValidateFeedContent.mockResolvedValue(true);
    mockFetchFeedBody.mockResolvedValue(RSS_BODY);
    mockDetectFeedSource.mockReturnValue("rss");
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
    mockValidateFeedContent.mockResolvedValue(false);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/not-a-feed" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("does not insert the feed when validation fails", async () => {
    mockValidateFeedContent.mockResolvedValue(false);
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
    expect(result).toMatchObject({ ...mockFeed, detectedSource: "rss" });
  });

  it("calls detectFeedSource with the fetched feed body", async () => {
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    await handler(event);
    expect(mockDetectFeedSource).toHaveBeenCalledWith(RSS_BODY);
  });

  it("stores rss source when detectFeedSource returns rss", async () => {
    mockDetectFeedSource.mockReturnValue("rss");
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

  it("stores podcast source when detectFeedSource returns podcast", async () => {
    mockDetectFeedSource.mockReturnValue("podcast");
    const podFeed = { ...mockFeed, source: "podcast" };
    mockReturning.mockResolvedValue([podFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://podcast.example.com/rss" },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: "podcast" }),
    );
  });

  it("uses sourceOverride when provided, ignoring detected source", async () => {
    mockDetectFeedSource.mockReturnValue("rss");
    const overriddenFeed = {
      ...mockFeed,
      source: "podcast",
      sourceOverride: "podcast",
    };
    mockReturning.mockResolvedValue([overriddenFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml", sourceOverride: "podcast" },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: "podcast", sourceOverride: "podcast" }),
    );
  });

  it("stores null sourceOverride when no override is provided", async () => {
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ sourceOverride: null }),
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
