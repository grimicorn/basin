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

const discoverRssResult = {
  feedUrl: "https://a.com/feed.xml",
  detectedSource: "rss",
};

const discoverPodcastResult = {
  feedUrl: "https://a.com/podcast.xml",
  detectedSource: "podcast",
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

    it("calls the discover endpoint and sets pendingFeed on success", async () => {
      mockFetch.mockResolvedValueOnce([feedB]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      const { newUrl, pendingFeed, load, add } = useFeeds();
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
      expect(pendingFeed.value).toEqual({
        url: "https://a.com/feed.xml",
        detectedSource: "rss",
        sourceOverride: null,
      });
    });

    it("sets pendingFeed with podcast detectedSource for podcast feeds", async () => {
      mockFetch.mockResolvedValueOnce([feedB]); // load
      mockFetch.mockResolvedValueOnce(discoverPodcastResult); // discover
      const { newUrl, pendingFeed, load, add } = useFeeds();
      await load();
      newUrl.value = "https://a.com/podcast";
      await add();
      expect(pendingFeed.value).toEqual({
        url: "https://a.com/podcast.xml",
        detectedSource: "podcast",
        sourceOverride: null,
      });
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

    it("clears a previous error when add() is called", async () => {
      const networkError = Object.assign(new Error("Network failure"), {
        statusCode: 500,
      });
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockRejectedValueOnce(networkError); // first add fails
      mockFetch.mockResolvedValueOnce(discoverRssResult); // second add succeeds
      const { error, newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://example.com";
      await add();
      expect(error.value).toBeTruthy();
      // Second attempt should clear the error during discover
      newUrl.value = "https://example.com";
      await add();
      expect(error.value).toBeNull();
    });

    it("does not set pendingFeed when discover returns null (no feed found)", async () => {
      const notFoundError = Object.assign(new Error("No feed found"), {
        statusCode: 422,
      });
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockRejectedValueOnce(notFoundError); // discover returns 422
      const { pendingFeed, newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "https://not-a-feed-site.com";
      await add();
      expect(pendingFeed.value).toBeNull();
    });

    it("trims whitespace from newUrl before calling discover", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      const { newUrl, load, add } = useFeeds();
      await load();
      newUrl.value = "  https://a.com  ";
      await add();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds/discover",
        expect.objectContaining({
          body: { url: "https://a.com" },
        }),
      );
    });
  });

  describe("confirmAdd()", () => {
    it("does nothing when there is no pendingFeed", async () => {
      const { confirmAdd } = useFeeds();
      await confirmAdd();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("posts to /api/feeds with the pending URL and prepends the new feed", async () => {
      mockFetch.mockResolvedValueOnce([feedB]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      mockFetch.mockResolvedValueOnce(feedA); // confirmAdd
      const { items, newUrl, pendingFeed, load, add, confirmAdd } = useFeeds();
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
          body: { url: "https://a.com/feed.xml" },
        }),
      );
      expect(pendingFeed.value).toBeNull();
    });

    it("sends sourceOverride when it differs from detectedSource", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      mockFetch.mockResolvedValueOnce(feedA); // confirmAdd
      const { newUrl, load, add, confirmAdd, setSourceOverride } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      setSourceOverride("podcast");
      await confirmAdd();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds",
        expect.objectContaining({
          method: "POST",
          body: { url: "https://a.com/feed.xml", sourceOverride: "podcast" },
        }),
      );
    });

    it("does not send sourceOverride when it matches detectedSource", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      mockFetch.mockResolvedValueOnce(feedA); // confirmAdd
      const { newUrl, load, add, confirmAdd, setSourceOverride } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      setSourceOverride(null); // no override
      await confirmAdd();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds",
        expect.objectContaining({
          method: "POST",
          body: { url: "https://a.com/feed.xml" },
        }),
      );
    });

    it("clears newUrl and pendingFeed after a successful add", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      mockFetch.mockResolvedValueOnce(feedA); // confirmAdd
      const { newUrl, pendingFeed, load, add, confirmAdd } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      await confirmAdd();
      expect(newUrl.value).toBe("");
      expect(pendingFeed.value).toBeNull();
    });

    it("sets error and keeps pendingFeed when the POST to /api/feeds fails", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      mockFetch.mockRejectedValueOnce(new Error("server error")); // confirmAdd fails
      const { error, newUrl, pendingFeed, load, add, confirmAdd } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      await confirmAdd();
      expect(error.value).toBeTruthy();
      expect(pendingFeed.value).not.toBeNull();
    });

    it("sends sourceOverride when it equals the detectedSource (non-null always sent)", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover (detectedSource: rss)
      mockFetch.mockResolvedValueOnce(feedA); // confirmAdd
      const { newUrl, load, add, confirmAdd, setSourceOverride } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      // Override back to the same as detected — should still be included since it's non-null
      setSourceOverride("rss");
      await confirmAdd();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feeds",
        expect.objectContaining({
          method: "POST",
          body: { url: "https://a.com/feed.xml", sourceOverride: "rss" },
        }),
      );
    });

    it("clears previous error before posting when confirmAdd succeeds", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      mockFetch.mockRejectedValueOnce(new Error("first attempt fails")); // first confirmAdd
      mockFetch.mockResolvedValueOnce(feedA); // second confirmAdd succeeds
      const { error, newUrl, load, add, confirmAdd } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      await confirmAdd(); // fails → sets error
      expect(error.value).toBeTruthy();
      await confirmAdd(); // succeeds → clears error
      expect(error.value).toBeNull();
    });
  });

  describe("cancelAdd()", () => {
    it("clears pendingFeed and error", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      const { error, newUrl, pendingFeed, load, add, cancelAdd } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      expect(pendingFeed.value).not.toBeNull();
      cancelAdd();
      expect(pendingFeed.value).toBeNull();
      expect(error.value).toBeNull();
    });

    it("does nothing and does not throw when called with no pendingFeed", () => {
      const { cancelAdd } = useFeeds();
      expect(() => cancelAdd()).not.toThrow();
    });

    it("preserves newUrl after cancelAdd so the user can retry", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      const { newUrl, load, add, cancelAdd } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      cancelAdd();
      expect(newUrl.value).toBe("https://a.com");
    });

    it("also clears a pre-existing error set before the pending state", async () => {
      const networkError = Object.assign(new Error("Network failure"), {
        statusCode: 500,
      });
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockRejectedValueOnce(networkError); // first add fails → sets error
      mockFetch.mockResolvedValueOnce(discoverRssResult); // second add succeeds
      const { error, newUrl, load, add, cancelAdd } = useFeeds();
      await load();
      newUrl.value = "https://example.com";
      await add(); // sets error
      expect(error.value).toBeTruthy();
      newUrl.value = "https://a.com";
      await add(); // gets pending feed
      cancelAdd(); // should clear error
      expect(error.value).toBeNull();
    });
  });

  describe("setSourceOverride()", () => {
    it("updates sourceOverride on pendingFeed", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      const { newUrl, pendingFeed, load, add, setSourceOverride } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      setSourceOverride("podcast");
      expect(pendingFeed.value?.sourceOverride).toBe("podcast");
    });

    it("does nothing when there is no pendingFeed", () => {
      const { setSourceOverride } = useFeeds();
      // Should not throw
      setSourceOverride("podcast");
    });

    it("can set sourceOverride back to null", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      const { newUrl, pendingFeed, load, add, setSourceOverride } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      setSourceOverride("podcast");
      expect(pendingFeed.value?.sourceOverride).toBe("podcast");
      setSourceOverride(null);
      expect(pendingFeed.value?.sourceOverride).toBeNull();
    });

    it("preserves other pendingFeed fields when updating sourceOverride", async () => {
      mockFetch.mockResolvedValueOnce([]); // load
      mockFetch.mockResolvedValueOnce(discoverRssResult); // discover
      const { newUrl, pendingFeed, load, add, setSourceOverride } = useFeeds();
      await load();
      newUrl.value = "https://a.com";
      await add();
      setSourceOverride("podcast");
      expect(pendingFeed.value?.url).toBe("https://a.com/feed.xml");
      expect(pendingFeed.value?.detectedSource).toBe("rss");
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
