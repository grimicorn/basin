import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../server/utils/algolia", () => ({
  saveItems: vi.fn(),
}));

const mockFindManyFeeds = vi.fn();
const mockFindManyFeedItems = vi.fn();

vi.stubGlobal("useDb", () => ({
  query: {
    feeds: { findMany: mockFindManyFeeds },
    feedItems: { findMany: mockFindManyFeedItems },
  },
}));

import { saveItems } from "../../../../server/utils/algolia";
import handler from "../../../../server/api/search/sync.post";

const mockSaveItems = vi.mocked(saveItems);

const mockFeed = {
  id: 10,
  userId: 1,
  url: "https://example.com/feed.xml",
  title: "Example Feed",
  source: "rss",
};

const mockFeedItem = {
  id: 1,
  feedId: 10,
  guid: "guid-1",
  title: "Test Article",
  url: "https://example.com/article",
  content: "Some content",
  tags: ["tech"],
  publishedAt: new Date("2024-01-01T00:00:00.000Z"),
  readAt: null,
  starred: false,
  savedAt: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

describe("POST /api/search/sync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns synced count of 0 when user has no feeds", async () => {
    mockFindManyFeeds.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual({ synced: 0 });
    expect(mockSaveItems).not.toHaveBeenCalled();
  });

  it("returns synced count of 0 when feeds have no items", async () => {
    mockFindManyFeeds.mockResolvedValue([mockFeed]);
    mockFindManyFeedItems.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual({ synced: 0 });
    expect(mockSaveItems).not.toHaveBeenCalled();
  });

  it("syncs feed items and returns the count", async () => {
    mockFindManyFeeds.mockResolvedValue([mockFeed]);
    mockFindManyFeedItems.mockResolvedValue([mockFeedItem]);
    mockSaveItems.mockResolvedValue(undefined);
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual({ synced: 1 });
    expect(mockSaveItems).toHaveBeenCalledTimes(1);
  });

  it("passes correctly shaped Algolia objects to saveItems", async () => {
    mockFindManyFeeds.mockResolvedValue([mockFeed]);
    mockFindManyFeedItems.mockResolvedValue([mockFeedItem]);
    mockSaveItems.mockResolvedValue(undefined);
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockSaveItems).toHaveBeenCalledWith([
      expect.objectContaining({
        objectID: "feed_item_1",
        userId: 1,
        feedId: 10,
        guid: "guid-1",
        title: "Test Article",
        url: "https://example.com/article",
        content: "Some content",
        tags: ["tech"],
        publishedAt: "2024-01-01T00:00:00.000Z",
      }),
    ]);
  });

  it("syncs multiple feed items at once", async () => {
    const secondItem = { ...mockFeedItem, id: 2, guid: "guid-2" };
    mockFindManyFeeds.mockResolvedValue([mockFeed]);
    mockFindManyFeedItems.mockResolvedValue([mockFeedItem, secondItem]);
    mockSaveItems.mockResolvedValue(undefined);
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual({ synced: 2 });
    const savedItems = mockSaveItems.mock.calls[0][0];
    expect(savedItems).toHaveLength(2);
  });
});
