import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFeeds } from "~/composables/useFeeds";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

const feedA = {
  id: 1,
  url: "https://a.com/feed.xml",
  title: "Feed A",
  source: "rss",
  createdAt: null,
};
const feedB = {
  id: 2,
  url: "https://b.com/feed.xml",
  title: "Feed B",
  source: "rss",
  createdAt: null,
};

describe("useFeeds", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("load()", () => {
    it("fetches from /api/feeds and populates items", async () => {
      mockFetch.mockResolvedValue([feedA, feedB]);
      const { items, load } = useFeeds();
      await load();
      expect(items.value).toEqual([feedA, feedB]);
      expect(mockFetch).toHaveBeenCalledWith("/api/feeds", expect.any(Object));
    });

    it("sets error and leaves items empty on failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      const { items, error, load } = useFeeds();
      await load();
      expect(error.value).toBeTruthy();
      expect(items.value).toEqual([]);
    });

    it("clears a previous error on successful load", async () => {
      const { error, load } = useFeeds();
      mockFetch.mockRejectedValueOnce(new Error("oops"));
      await load();
      mockFetch.mockResolvedValueOnce([feedA]);
      await load();
      expect(error.value).toBeNull();
    });
  });

  describe("add()", () => {
    it("does nothing when newUrl is empty", async () => {
      mockFetch.mockResolvedValue([]);
      const { load, add } = useFeeds();
      await load();
      await add();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("posts to /api/feeds and prepends the new feed", async () => {
      mockFetch.mockResolvedValueOnce([feedB]);
      mockFetch.mockResolvedValueOnce(feedA);
      const { items, newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://a.com/feed.xml";
      await add();
      expect(items.value[0]).toEqual(feedA);
      expect(items.value).toHaveLength(2);
    });

    it("clears newUrl after a successful add", async () => {
      mockFetch.mockResolvedValueOnce([]);
      mockFetch.mockResolvedValueOnce(feedA);
      const { newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://a.com/feed.xml";
      await add();
      expect(newUrl.value).toBe("");
    });

    it("sets error and keeps newUrl on failure", async () => {
      mockFetch.mockResolvedValueOnce([]);
      mockFetch.mockRejectedValueOnce(new Error("bad url"));
      const { error, newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "not-a-real-url";
      await add();
      expect(error.value).toBeTruthy();
      expect(newUrl.value).toBe("not-a-real-url");
    });
  });

  describe("remove()", () => {
    it("optimistically removes the feed from items", async () => {
      mockFetch.mockResolvedValueOnce([feedA, feedB]);
      mockFetch.mockResolvedValueOnce({ ok: true });
      const { items, load, remove } = useFeeds();
      await load();
      await remove(feedA.id);
      expect(items.value).toHaveLength(1);
      expect(items.value[0].id).toBe(feedB.id);
    });

    it("sends DELETE to /api/feeds/:id", async () => {
      mockFetch.mockResolvedValueOnce([feedA]);
      mockFetch.mockResolvedValueOnce({ ok: true });
      const { load, remove } = useFeeds();
      await load();
      await remove(feedA.id);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds/1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("restores the feed and sets error when DELETE fails", async () => {
      mockFetch.mockResolvedValueOnce([feedA, feedB]);
      mockFetch.mockRejectedValueOnce(new Error("Server error"));
      const { items, error, load, remove } = useFeeds();
      await load();
      await remove(feedA.id);
      expect(items.value).toHaveLength(2);
      expect(error.value).toBeTruthy();
    });

    it("does nothing when the id is not in the list", async () => {
      mockFetch.mockResolvedValueOnce([feedA]);
      const { items, load, remove } = useFeeds();
      await load();
      await remove(999);
      expect(items.value).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
