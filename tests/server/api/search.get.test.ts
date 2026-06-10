import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/utils/algolia", () => ({
  searchFeedItems: vi.fn(),
}));

const mockGetQuery = vi.fn();
vi.stubGlobal("getQuery", mockGetQuery);

import { searchFeedItems } from "../../../server/utils/algolia";
import handler from "../../../server/api/search.get";

const mockSearchFeedItems = vi.mocked(searchFeedItems);

const mockHits = [
  {
    objectID: "feed_item_1",
    guid: "guid-1",
    title: "Test Article",
    url: "https://example.com/article",
    content: "Some content",
    tags: ["tech"],
    publishedAt: "2024-01-01T00:00:00.000Z",
  },
];

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null } };
    mockGetQuery.mockReturnValue({ q: "test" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns search results for authenticated user", async () => {
    mockSearchFeedItems.mockResolvedValue(mockHits);
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ q: "test" });
    const result = await handler(event);
    expect(result).toEqual(mockHits);
  });

  it("passes the query and user id to searchFeedItems", async () => {
    mockSearchFeedItems.mockResolvedValue([]);
    const event = { context: { user: { id: 42 } } };
    mockGetQuery.mockReturnValue({ q: "hello world" });
    await handler(event);
    expect(mockSearchFeedItems).toHaveBeenCalledWith("hello world", 42);
  });

  it("returns empty array when no results found", async () => {
    mockSearchFeedItems.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ q: "nomatches" });
    const result = await handler(event);
    expect(result).toEqual([]);
  });

  it("treats a missing query param as empty string", async () => {
    mockSearchFeedItems.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({});
    await handler(event);
    expect(mockSearchFeedItems).toHaveBeenCalledWith("", 1);
  });

  it("trims whitespace from the query before searching", async () => {
    mockSearchFeedItems.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ q: "  spaces  " });
    await handler(event);
    expect(mockSearchFeedItems).toHaveBeenCalledWith("spaces", 1);
  });
});
