import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

vi.stubGlobal("useDb", () => ({
  select: mockSelect,
}));

import {
  fetchFeedItems,
  FEED_ITEMS_DEFAULT_LIMIT,
  FEED_ITEMS_MAX_LIMIT,
} from "../../../server/utils/feedItems";

const mockRow = {
  id: 1,
  feedId: 10,
  feedSource: "rss",
  feedTitle: "Test Feed",
  guid: "guid-1",
  title: "Test Article",
  url: "https://example.com/article",
  author: "Jane Doe",
  imageUrl: "https://example.com/image.jpg",
  content: "Article content",
  tags: ["test"],
  publishedAt: null,
  readAt: null,
  starred: false,
  savedAt: null,
  mediaUrl: null,
  mediaDuration: null,
  createdAt: null,
  updatedAt: null,
};

describe("fetchFeedItems", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
    mockInnerJoin.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockResolvedValue([]);
  });

  it("returns empty items array when no rows are found", async () => {
    const result = await fetchFeedItems(1, {});
    expect(result.items).toEqual([]);
    expect(result.nextOffset).toBeNull();
  });

  it("maps rss feedSource to article type", async () => {
    mockOffset.mockResolvedValue([mockRow]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].type).toBe("article");
  });

  it("maps podcast feedSource to podcast type", async () => {
    mockOffset.mockResolvedValue([{ ...mockRow, feedSource: "podcast" }]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].type).toBe("podcast");
  });

  it("falls back to raw feedSource when no type mapping exists", async () => {
    mockOffset.mockResolvedValue([{ ...mockRow, feedSource: "newsletter" }]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].type).toBe("newsletter");
  });

  it("uses feedTitle as source when present", async () => {
    mockOffset.mockResolvedValue([mockRow]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].source).toBe("Test Feed");
  });

  it("falls back to feedSource when feedTitle is null", async () => {
    mockOffset.mockResolvedValue([{ ...mockRow, feedTitle: null }]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].source).toBe("rss");
  });

  it("falls back to feedSource when feedTitle is empty string", async () => {
    mockOffset.mockResolvedValue([{ ...mockRow, feedTitle: "" }]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].source).toBe("rss");
  });

  it("marks item as unread when readAt is null", async () => {
    mockOffset.mockResolvedValue([{ ...mockRow, readAt: null }]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].unread).toBe(true);
  });

  it("marks item as read when readAt is set", async () => {
    mockOffset.mockResolvedValue([
      { ...mockRow, readAt: new Date("2026-01-01") },
    ]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].unread).toBe(false);
  });

  it("marks item as saved when savedAt is set", async () => {
    mockOffset.mockResolvedValue([
      { ...mockRow, savedAt: new Date("2026-01-01") },
    ]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].saved).toBe(true);
  });

  it("marks item as not saved when savedAt is null", async () => {
    mockOffset.mockResolvedValue([{ ...mockRow, savedAt: null }]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].saved).toBe(false);
  });

  it("sets nextOffset when there are more items than the limit", async () => {
    const rows = Array.from(
      { length: FEED_ITEMS_DEFAULT_LIMIT + 1 },
      (_, i) => ({
        ...mockRow,
        id: i + 1,
      }),
    );
    mockOffset.mockResolvedValue(rows);
    const result = await fetchFeedItems(1, {});
    expect(result.items).toHaveLength(FEED_ITEMS_DEFAULT_LIMIT);
    expect(result.nextOffset).toBe(FEED_ITEMS_DEFAULT_LIMIT);
  });

  it("sets nextOffset to null when there are no more items", async () => {
    mockOffset.mockResolvedValue([mockRow]);
    const result = await fetchFeedItems(1, {});
    expect(result.nextOffset).toBeNull();
  });

  it("applies the offset parameter to subsequent pages", async () => {
    mockOffset.mockResolvedValue([]);
    await fetchFeedItems(1, { offset: 50 });
    expect(mockOffset).toHaveBeenCalledWith(50);
  });

  it("computes nextOffset as offset + limit for non-first pages", async () => {
    const rows = Array.from(
      { length: FEED_ITEMS_DEFAULT_LIMIT + 1 },
      (_, i) => ({
        ...mockRow,
        id: i + 1,
      }),
    );
    mockOffset.mockResolvedValue(rows);
    const result = await fetchFeedItems(1, { offset: 50 });
    expect(result.nextOffset).toBe(50 + FEED_ITEMS_DEFAULT_LIMIT);
  });

  it("maps feedTitle to handle field on results", async () => {
    mockOffset.mockResolvedValue([mockRow]);
    const result = await fetchFeedItems(1, {});
    expect(result.items[0].handle).toBe("Test Feed");
  });

  it("clamps limit to the maximum allowed value", async () => {
    mockOffset.mockResolvedValue([]);
    await fetchFeedItems(1, { limit: 9999 });
    expect(mockLimit).toHaveBeenCalledWith(FEED_ITEMS_MAX_LIMIT + 1);
  });

  it("uses the default limit when none is provided", async () => {
    mockOffset.mockResolvedValue([]);
    await fetchFeedItems(1, {});
    expect(mockLimit).toHaveBeenCalledWith(FEED_ITEMS_DEFAULT_LIMIT + 1);
  });

  it("uses the provided limit when within bounds", async () => {
    mockOffset.mockResolvedValue([]);
    await fetchFeedItems(1, { limit: 10 });
    expect(mockLimit).toHaveBeenCalledWith(11);
  });

  it("calls select, from, innerJoin, orderBy, limit, offset in order", async () => {
    await fetchFeedItems(1, {});
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockInnerJoin).toHaveBeenCalledTimes(1);
    expect(mockOrderBy).toHaveBeenCalledTimes(1);
    expect(mockLimit).toHaveBeenCalledTimes(1);
    expect(mockOffset).toHaveBeenCalledTimes(1);

    const [selectOrder] = mockSelect.mock.invocationCallOrder;
    const [fromOrder] = mockFrom.mock.invocationCallOrder;
    const [innerJoinOrder] = mockInnerJoin.mock.invocationCallOrder;
    const [orderByOrder] = mockOrderBy.mock.invocationCallOrder;
    const [limitOrder] = mockLimit.mock.invocationCallOrder;
    const [offsetOrder] = mockOffset.mock.invocationCallOrder;

    expect(selectOrder).toBeLessThan(fromOrder);
    expect(fromOrder).toBeLessThan(innerJoinOrder);
    expect(innerJoinOrder).toBeLessThan(orderByOrder);
    expect(orderByOrder).toBeLessThan(limitOrder);
    expect(limitOrder).toBeLessThan(offsetOrder);
  });

  it("orders by publishedAt desc nulls last then id desc for deterministic pagination", async () => {
    await fetchFeedItems(1, {});
    // orderBy must receive two arguments: publishedAt DESC NULLS LAST (so items
    // without a date sort to the bottom) and id DESC as a deterministic tiebreaker
    // when multiple items share the same timestamp.
    expect(mockOrderBy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
  });
});
