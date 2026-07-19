import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFeeds } from "~/composables/useFeeds";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

const feedA = {
  id: 1,
  url: "https://a.com/feed.xml",
  title: "Feed A",
  source: "rss",
  sourceOverride: null,
  detectedSource: "rss",
  createdAt: null,
};
const feedB = {
  id: 2,
  url: "https://b.com/feed.xml",
  title: "Feed B",
  source: "rss",
  sourceOverride: null,
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

    it("passes through syncStatus and syncError from the API response", async () => {
      const failingFeed = {
        ...feedA,
        syncStatus: "error" as const,
        syncError: "Feed unreachable",
      };
      mockFetch.mockResolvedValue([failingFeed]);
      const { items, load } = useFeeds();
      await load();
      expect(items.value[0].syncStatus).toBe("error");
      expect(items.value[0].syncError).toBe("Feed unreachable");
    });
  });

  describe("add()", () => {
    // add() calls discover, then detect. confirmAdd() calls POST /api/feeds.
    // Mock order: 1) load → GET /api/feeds, 2) discover → POST /api/feeds/discover,
    //             3) detect → POST /api/feeds/detect

    it("does nothing when newUrl is empty", async () => {
      mockFetch.mockResolvedValue([]);
      const { load, add } = useFeeds();
      await load();
      await add();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("calls the discover endpoint before detect", async () => {
      mockFetch.mockResolvedValueOnce([feedB]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce({ detectedSource: "rss" }); // detect
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

    it("calls the detect endpoint with the discovered URL", async () => {
      mockFetch.mockResolvedValueOnce([feedB]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce({ detectedSource: "podcast" }); // detect
      const { newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds/detect",
        expect.objectContaining({
          method: "POST",
          body: { url: "https://a.com/feed.xml" },
        }),
      );
    });

    it("sets detectedSource and pendingFeedUrl after successful detection", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce({ detectedSource: "podcast" }); // detect
      const { newUrl, load, add, detectedSource, pendingFeedUrl } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      expect(detectedSource.value).toBe("podcast");
      expect(pendingFeedUrl.value).toBe("https://a.com/feed.xml");
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
  });

  describe("confirmAdd()", () => {
    it("does nothing when there is no pendingFeedUrl", async () => {
      const { confirmAdd } = useFeeds();
      await confirmAdd();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("posts to /api/feeds with the pending URL and prepends the new feed", async () => {
      mockFetch.mockResolvedValueOnce([feedB]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce({ detectedSource: "rss" }); // detect
      mockFetch.mockResolvedValueOnce(feedA); // confirmAdd
      const { items, newUrl, load, add, confirmAdd } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      await confirmAdd();
      expect(items.value[0]).toEqual(feedA);
      expect(items.value).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({ url: "https://a.com/feed.xml" }),
        }),
      );
    });

    it("passes sourceOverride to the API when set", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce({ detectedSource: "rss" }); // detect
      mockFetch.mockResolvedValueOnce(feedA); // confirmAdd
      const { newUrl, load, add, confirmAdd, sourceOverride } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      sourceOverride.value = "podcast";
      await confirmAdd();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds",
        expect.objectContaining({
          body: expect.objectContaining({ sourceOverride: "podcast" }),
        }),
      );
    });

    it("clears newUrl, detectedSource, sourceOverride, and pendingFeedUrl after success", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce({ detectedSource: "rss" }); // detect
      mockFetch.mockResolvedValueOnce(feedA); // confirmAdd
      const {
        newUrl,
        load,
        add,
        confirmAdd,
        detectedSource,
        sourceOverride,
        pendingFeedUrl,
      } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      await confirmAdd();
      expect(newUrl.value).toBe("");
      expect(detectedSource.value).toBeNull();
      expect(sourceOverride.value).toBeNull();
      expect(pendingFeedUrl.value).toBeNull();
    });

    it("sets error and keeps state when the POST to /api/feeds fails", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce({ feedUrl: "https://a.com/feed.xml" }); // discover
      mockFetch.mockResolvedValueOnce({ detectedSource: "rss" }); // detect
      mockFetch.mockRejectedValueOnce(new Error("server error")); // confirmAdd fails
      const { error, newUrl, load, add, confirmAdd, pendingFeedUrl } =
        useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      await confirmAdd();
      expect(error.value).toBeTruthy();
      expect(pendingFeedUrl.value).toBe("https://a.com/feed.xml");
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
