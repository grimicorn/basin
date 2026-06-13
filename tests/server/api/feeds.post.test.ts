import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

vi.stubGlobal("useDb", () => ({ insert: mockInsert }));

vi.mock("../../../server/utils/feedValidator", () => ({
  validateFeedUrl: vi.fn(),
}));

import handler from "../../../server/api/feeds.post";
import { validateFeedUrl } from "../../../server/utils/feedValidator";

const mockValidateFeedUrl = vi.mocked(validateFeedUrl);

const mockFeed = {
  id: 1,
  url: "https://example.com/feed.xml",
  source: "rss",
  userId: 1,
};

describe("POST /api/feeds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    // Default to a valid feed so existing tests don't need to care about validation
    mockValidateFeedUrl.mockResolvedValue(true);
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
    mockValidateFeedUrl.mockResolvedValue(false);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/not-a-feed" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("does not insert the feed when validation fails", async () => {
    mockValidateFeedUrl.mockResolvedValue(false);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/not-a-feed" },
    };
    await expect(handler(event)).rejects.toBeDefined();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts the feed and returns it", async () => {
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    const result = await handler(event);
    expect(result).toEqual(mockFeed);
  });

  it("detects rss source for a plain feed URL", async () => {
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

  it("detects podcast source from URL containing 'podcast'", async () => {
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
