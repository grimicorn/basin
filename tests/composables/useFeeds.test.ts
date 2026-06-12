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
    // add() now calls discover first, then POST /api/feeds.
    // Mock order: 1) load → GET /api/feeds, 2) discover → POST /api/feeds/discover, 3) add → POST /api/feeds

    it("does nothing when newUrl is empty", async () => {
      mockFetch.mockResolvedValue([]);
      const { load, add } = useFeeds();
      await load();
      await add();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("calls the discover endpoint before posting to /api/feeds", async () => {
      mockFetch.mockResolvedValueOnce([feedB]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce(feedA); // add
      const { newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds/discover",
        expect.objectContaining({
          method: "POST",
          body: { url: "https://a.com" },
        }),
      );
    });

    it("posts to /api/feeds with the discovered URL and prepends the new feed", async () => {
      mockFetch.mockResolvedValueOnce([feedB]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce(feedA); // add
      const { items, newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      expect(items.value[0]).toEqual(feedA);
      expect(items.value).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds",
        expect.objectContaining({
          method: "POST",
          body: { url: "https://a.com/feed.xml" },
        }),
      );
    });

    it("clears newUrl after a successful add", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce(feedA); // add
      const { newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      expect(newUrl.value).toBe("");
    });

    it("sets 'no feed found' error and keeps newUrl when discover returns 422", async () => {
      const notFoundError = Object.assign(new Error("No feed found"), {
        statusCode: 422,
      });
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockRejectedValueOnce(notFoundError); // discover returns 422
      const { error, newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://not-a-feed-site.com";
      await add();
      expect(error.value).toBe(
        "No feed found at that URL — check the address and try again",
      );
      expect(newUrl.value).toBe("https://not-a-feed-site.com");
    });

    it("sets a generic error and keeps newUrl when discover throws a non-422 error", async () => {
      const networkError = Object.assign(new Error("Network failure"), {
        statusCode: 500,
      });
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockRejectedValueOnce(networkError); // discover throws non-422
      const { error, newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://example.com";
      await add();
      expect(error.value).toBe(
        "Something went wrong while finding the feed — try again",
      );
      expect(newUrl.value).toBe("https://example.com");
    });

    it("sets error and keeps newUrl when the POST to /api/feeds fails", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockRejectedValueOnce(new Error("server error")); // add fails
      const { error, newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      expect(error.value).toBeTruthy();
      expect(newUrl.value).toBe("https://a.com");
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
