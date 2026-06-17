import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useFeedStore } from "~/stores/feed";
import { makeFeed, makeConnection } from "../fixtures";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

const item = (overrides: Record<string, unknown> = {}) => ({
  id: Math.floor(Math.random() * 1e9),
  type: "article",
  source: "Test",
  handle: "test.com",
  title: "Test Item",
  excerpt: "Excerpt.",
  time: "1h",
  meta: "3 min",
  tags: [],
  unread: true,
  saved: false,
  ...overrides,
});

describe("useFeedStore", () => {
  let feed: ReturnType<typeof useFeedStore>;
  let state: ReturnType<typeof useFeedStore>["state"];

  beforeEach(() => {
    setActivePinia(createPinia());
    feed = useFeedStore();
    state = feed.state;
    vi.useFakeTimers();
    mockFetch.mockReset();
    state.items = [
      item({ id: 1, type: "article", unread: true, saved: false }),
      item({ id: 2, type: "video", unread: false, saved: true }),
      item({ id: 3, type: "podcast", unread: true, saved: false }),
      item({ id: 4, type: "tweet", unread: false, saved: false }),
      item({ id: 5, type: "photo", unread: true, saved: true }),
    ];
    state.filter = "all";
    state.unreadOnly = false;
    state.activeItem = null;
    state.detailLoading = false;
    state.loading = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("countFor", () => {
    it("counts all items", () => {
      expect(feed.countFor("all")).toBe(5);
    });

    it("counts items by type", () => {
      expect(feed.countFor("article")).toBe(1);
      expect(feed.countFor("video")).toBe(1);
      expect(feed.countFor("podcast")).toBe(1);
    });

    it("counts saved items", () => {
      expect(feed.countFor("saved")).toBe(2);
    });
  });

  describe("unreadCount", () => {
    it("returns the number of unread items", () => {
      expect(feed.unreadCount).toBe(3);
    });

    it("updates when an item changes", () => {
      state.items[0].unread = false;
      expect(feed.unreadCount).toBe(2);
    });
  });

  describe("visibleItems", () => {
    it("returns all items when filter is all", () => {
      state.filter = "all";
      expect(feed.visibleItems).toHaveLength(5);
    });

    it("filters by type", () => {
      state.filter = "article";
      const visible = feed.visibleItems;
      expect(visible).toHaveLength(1);
      expect(visible[0].type).toBe("article");
    });

    it("filters saved items", () => {
      state.filter = "saved";
      expect(feed.visibleItems).toHaveLength(2);
      expect(feed.visibleItems.every((i) => i.saved)).toBe(true);
    });

    it("applies unreadOnly across filter", () => {
      state.unreadOnly = true;
      state.filter = "all";
      expect(feed.visibleItems).toHaveLength(3);
      expect(feed.visibleItems.every((i) => i.unread)).toBe(true);
    });
  });

  describe("toggleSave", () => {
    it("saves an unsaved item", () => {
      const i = state.items[0];
      i.saved = false;
      feed.toggleSave(i);
      expect(i.saved).toBe(true);
    });

    it("unsaves a saved item", () => {
      const i = state.items[0];
      i.saved = true;
      feed.toggleSave(i);
      expect(i.saved).toBe(false);
    });
  });

  describe("markAllRead", () => {
    it("sets unread=false on all items", () => {
      feed.markAllRead();
      expect(state.items.every((i) => !i.unread)).toBe(true);
    });
  });

  describe("openItem", () => {
    it("sets activeItem and marks it read", () => {
      const i = state.items[0];
      i.unread = true;
      feed.openItem(i);
      expect(state.activeItem).toBe(i);
      expect(i.unread).toBe(false);
    });

    it("sets detailLoading=true then false after 520ms", () => {
      feed.openItem(state.items[0]);
      expect(state.detailLoading).toBe(true);
      vi.advanceTimersByTime(520);
      expect(state.detailLoading).toBe(false);
    });
  });

  describe("closeDetail", () => {
    it("clears activeItem", () => {
      state.activeItem = state.items[0];
      feed.closeDetail();
      expect(state.activeItem).toBeNull();
    });
  });

  describe("detailNav", () => {
    it("moves to the next item", () => {
      state.activeItem = state.items[0];
      feed.detailNav(1);
      expect(state.activeItem!.id).toBe(2);
    });

    it("moves to the previous item", () => {
      state.activeItem = state.items[1];
      feed.detailNav(-1);
      expect(state.activeItem!.id).toBe(1);
    });

    it("wraps around at the end", () => {
      state.activeItem = state.items[4];
      feed.detailNav(1);
      expect(state.activeItem!.id).toBe(1);
    });

    it("does nothing when no activeItem", () => {
      state.activeItem = null;
      feed.detailNav(1);
      expect(state.activeItem).toBeNull();
    });
  });

  describe("addFeed", () => {
    beforeEach(() => {
      state.feeds = [];
      state.newFeedUrl = "";
    });

    it("adds an RSS feed from a URL", () => {
      state.newFeedUrl = "https://example.com/feed.xml";
      feed.addFeed();
      expect(state.feeds).toHaveLength(1);
      expect(state.feeds[0].type).toBe("rss");
      expect(state.newFeedUrl).toBe("");
    });

    it("detects a podcast URL", () => {
      state.newFeedUrl = "https://podcast.example.com/feed";
      feed.addFeed();
      expect(state.feeds[0].type).toBe("podcast");
    });

    it("does nothing when URL is empty", () => {
      state.newFeedUrl = "   ";
      feed.addFeed();
      expect(state.feeds).toHaveLength(0);
    });
  });

  describe("removeFeed", () => {
    it("removes the feed with the given id", () => {
      state.feeds = [makeFeed({ id: "f1" }), makeFeed({ id: "f2" })] as never;
      feed.removeFeed("f1");
      expect(state.feeds).toHaveLength(1);
      expect(state.feeds[0].id).toBe("f2");
    });
  });

  describe("toggleConn", () => {
    it("connects a disconnected connection", () => {
      const conn = makeConnection({ connected: false, since: "" });
      feed.toggleConn(conn);
      expect(conn.connected).toBe(true);
      expect(conn.since).toBeTruthy();
    });

    it("disconnects a connected connection", () => {
      const conn = makeConnection({
        connected: true,
        since: "Connected just now",
      });
      feed.toggleConn(conn);
      expect(conn.connected).toBe(false);
      expect(conn.since).toBe("");
    });
  });

  describe("refresh", () => {
    it("sets syncing to true while the request is in flight", async () => {
      let resolveFetch!: () => void;
      mockFetch.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const refreshPromise = feed.refresh();
      expect(state.syncing).toBe(true);

      resolveFetch();
      await refreshPromise;
      expect(state.syncing).toBe(false);
    });

    it("resets syncing to false after a successful sync", async () => {
      mockFetch.mockResolvedValueOnce({ queued: 2, failed: 0 });
      await feed.refresh();
      expect(state.syncing).toBe(false);
    });

    it("resets syncing to false when the request fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      await feed.refresh();
      expect(state.syncing).toBe(false);
    });

    it("calls POST /api/feed-sync", async () => {
      mockFetch.mockResolvedValueOnce({ queued: 1, failed: 0 });
      await feed.refresh();
      expect(mockFetch).toHaveBeenCalledWith("/api/feed-sync", {
        method: "POST",
      });
    });

    it("does not make a second request when already syncing", async () => {
      let resolveFetch!: () => void;
      mockFetch.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const firstRefresh = feed.refresh();
      await feed.refresh();

      resolveFetch();
      await firstRefresh;

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("articleBody", () => {
    it("returns body paragraphs when present", () => {
      expect(
        feed.articleBody({ body: ["Para 1", "Para 2"], excerpt: "Ex" }),
      ).toEqual(["Para 1", "Para 2"]);
    });

    it("falls back to excerpt when body is empty", () => {
      const result = feed.articleBody({ body: [], excerpt: "Just an excerpt" });
      expect(result[0]).toBe("Just an excerpt");
    });
  });

  describe("podcastNotes", () => {
    it("returns notes when present", () => {
      expect(feed.podcastNotes({ notes: ["Note 1"], excerpt: "Ep" })).toEqual([
        "Note 1",
      ]);
    });

    it("falls back to excerpt when notes is empty", () => {
      const result = feed.podcastNotes({
        notes: [],
        excerpt: "Episode excerpt",
      });
      expect(result[0]).toBe("Episode excerpt");
    });
  });

  describe("videoDesc", () => {
    it("returns desc when present", () => {
      expect(
        feed.videoDesc({ desc: "Full description", title: "Video", views: "" }),
      ).toBe("Full description");
    });

    it("generates a description from title when desc is absent", () => {
      const result = feed.videoDesc({ title: "My Video", views: "500 views" });
      expect(result).toContain("My Video");
    });
  });
});
