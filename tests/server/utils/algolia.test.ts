import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSaveObjects = vi.fn();
const mockDeleteBy = vi.fn();
const mockSearchSingleIndex = vi.fn();

const mockAlgoliaClient = {
  saveObjects: mockSaveObjects,
  deleteBy: mockDeleteBy,
  searchSingleIndex: mockSearchSingleIndex,
};

vi.mock("algoliasearch", () => ({
  algoliasearch: vi.fn(() => mockAlgoliaClient),
}));

vi.stubGlobal("useRuntimeConfig", () => ({
  algoliaAppId: "test-app-id",
  algoliaAdminApiKey: "test-admin-key",
  algoliaIndexName: "test_feed_items",
}));

import {
  saveItems,
  deleteItemsByUserId,
  searchFeedItems,
} from "../../../server/utils/algolia";
import type { AlgoliaFeedItem } from "../../../server/utils/algolia";

const mockItem: AlgoliaFeedItem = {
  objectID: "feed_item_1",
  userId: 1,
  feedId: 10,
  guid: "guid-1",
  title: "Test Article",
  url: "https://example.com/article",
  content: "Some content",
  tags: ["tech"],
  publishedAt: "2024-01-01T00:00:00.000Z",
};

describe("algolia utils", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("saveItems", () => {
    it("calls saveObjects with the correct index and items", async () => {
      mockSaveObjects.mockResolvedValue(undefined);
      await saveItems([mockItem]);
      expect(mockSaveObjects).toHaveBeenCalledWith({
        indexName: "test_feed_items",
        objects: [mockItem],
      });
    });

    it("saves multiple items in a single call", async () => {
      mockSaveObjects.mockResolvedValue(undefined);
      const secondItem = { ...mockItem, objectID: "feed_item_2" };
      await saveItems([mockItem, secondItem]);
      const call = mockSaveObjects.mock.calls[0][0];
      expect(call.objects).toHaveLength(2);
    });
  });

  describe("deleteItemsByUserId", () => {
    it("calls deleteBy with a userId filter", async () => {
      mockDeleteBy.mockResolvedValue(undefined);
      await deleteItemsByUserId(42);
      expect(mockDeleteBy).toHaveBeenCalledWith({
        indexName: "test_feed_items",
        deleteByParams: {
          filters: "userId:42",
        },
      });
    });
  });

  describe("searchFeedItems", () => {
    it("calls searchSingleIndex with the query and userId filter", async () => {
      mockSearchSingleIndex.mockResolvedValue({ hits: [] });
      await searchFeedItems("hello", 7);
      expect(mockSearchSingleIndex).toHaveBeenCalledWith({
        indexName: "test_feed_items",
        searchParams: expect.objectContaining({
          query: "hello",
          filters: "userId:7",
        }),
      });
    });

    it("returns the hits from the search response", async () => {
      const hits = [{ objectID: "feed_item_1", title: "Result" }];
      mockSearchSingleIndex.mockResolvedValue({ hits });
      const results = await searchFeedItems("test", 1);
      expect(results).toEqual(hits);
    });

    it("returns an empty array when there are no hits", async () => {
      mockSearchSingleIndex.mockResolvedValue({ hits: [] });
      const results = await searchFeedItems("nomatches", 1);
      expect(results).toEqual([]);
    });
  });
});
