import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetQuery = vi.fn();

vi.stubGlobal("getQuery", mockGetQuery);
vi.mock("../../../server/utils/search");

import { searchFeedItems } from "../../../server/utils/search";
import handler from "../../../server/api/search.get";

const mockSearchFeedItems = vi.mocked(searchFeedItems);

const mockFeedItem = {
  id: 1,
  feedId: 10,
  guid: "guid-1",
  title: "Test Article",
  url: "https://example.com/article",
  author: "Jane Doe",
  imageUrl: "https://example.com/image.jpg",
  content: "Content about testing",
  tags: ["test"],
  publishedAt: null,
  readAt: null,
  starred: false,
  savedAt: null,
  createdAt: null,
  updatedAt: null,
};

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetQuery.mockReturnValue({});
  });

  it("throws 401 when unauthenticated", async () => {
    mockGetQuery.mockReturnValue({ q: "test" });
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when query parameter is missing", async () => {
    mockGetQuery.mockReturnValue({});
    const event = { context: { user: { id: 1 } } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when query parameter is blank", async () => {
    mockGetQuery.mockReturnValue({ q: "   " });
    const event = { context: { user: { id: 1 } } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns search results for authenticated user", async () => {
    mockGetQuery.mockReturnValue({ q: "testing" });
    mockSearchFeedItems.mockResolvedValue([mockFeedItem]);
    const event = { context: { user: { id: 1 } } };

    const result = await handler(event);

    expect(result).toEqual([mockFeedItem]);
  });

  it("calls searchFeedItems with the authenticated user id and trimmed query", async () => {
    mockGetQuery.mockReturnValue({ q: "  hello world  " });
    mockSearchFeedItems.mockResolvedValue([]);
    const event = { context: { user: { id: 42 } } };

    await handler(event);

    expect(mockSearchFeedItems).toHaveBeenCalledWith(42, "hello world");
  });

  it("returns an empty array when no results are found", async () => {
    mockGetQuery.mockReturnValue({ q: "noresults" });
    mockSearchFeedItems.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };

    const result = await handler(event);

    expect(result).toEqual([]);
  });
});
