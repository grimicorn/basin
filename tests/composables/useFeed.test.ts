import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useFeedStore } from "~/stores/feed";
import { makeFeed, makeConnection } from "../fixtures";

const item = (overrides: Record<string, unknown> = {}) => ({
  id: Math.floor(Math.random() * 1e9),
  feedId: 10,
  guid: "test-guid-1",
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
  starred: false,
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
    state.items = [
      item({ id: 1, type: "article", unread: true, saved: false }),
      item({ id: 2, type: "video", unread: false, saved: true }),
      item({ id: 3, type: "podcast", unread: true, saved: false }),
      item({ id: 4, type: "tweet", unread: false, saved: false }),
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
      expect(feed.countFor("all")).toBe(4);
    });

    it("counts items by type", () => {
      expect(feed.countFor("article")).toBe(1);
      expect(feed.countFor("video")).toBe(1);
      expect(feed.countFor("podcast")).toBe(1);
    });

    it("counts saved items", () => {
      expect(feed.countFor("saved")).toBe(1);
    });
  });

  describe("unreadCount", () => {
    it("returns the number of unread items", () => {
      expect(feed.unreadCount).toBe(2);
    });

    it("updates when an item changes", () => {
      state.items[0].unread = false;
      expect(feed.unreadCount).toBe(1);
    });
  });

  describe("visibleItems", () => {
    it("returns all items when filter is all", () => {
      state.filter = "all";
      expect(feed.visibleItems).toHaveLength(4);
    });

    it("filters by type", () => {
      state.filter = "article";
      const visible = feed.visibleItems;
      expect(visible).toHaveLength(1);
      expect(visible[0].type).toBe("article");
    });

    it("filters saved items", () => {
      state.filter = "saved";
      expect(feed.visibleItems).toHaveLength(1);
      expect(feed.visibleItems.every((i) => i.saved)).toBe(true);
    });

    it("applies unreadOnly across filter", () => {
      state.unreadOnly = true;
      state.filter = "all";
      expect(feed.visibleItems).toHaveLength(2);
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
      state.activeItem = state.items[3];
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

  describe("loadItems", () => {
    const pageOne = [item({ id: 101 }), item({ id: 102 })];
    const pageTwo = [item({ id: 103 }), item({ id: 104 })];

    beforeEach(() => {
      vi.mocked(globalThis.$fetch).mockReset();
    });

    it("replaces items when offset is 0 (first page)", async () => {
      vi.mocked(globalThis.$fetch).mockResolvedValue({
        items: pageOne,
        total: 2,
        nextOffset: null,
      });
      state.items = [item({ id: 999 })];
      await feed.loadItems({ offset: 0 });
      expect(state.items).toHaveLength(2);
      expect(state.items.map((i) => i.id)).toEqual([101, 102]);
    });

    it("replaces items when offset is omitted (first page)", async () => {
      vi.mocked(globalThis.$fetch).mockResolvedValue({
        items: pageOne,
        total: 2,
        nextOffset: null,
      });
      state.items = [item({ id: 999 })];
      await feed.loadItems();
      expect(state.items.map((i) => i.id)).toEqual([101, 102]);
    });

    it("appends items when offset is greater than 0 (subsequent page)", async () => {
      vi.mocked(globalThis.$fetch).mockResolvedValue({
        items: pageTwo,
        total: 4,
        nextOffset: null,
      });
      state.items = pageOne as never;
      await feed.loadItems({ offset: 2 });
      expect(state.items).toHaveLength(4);
      expect(state.items.map((i) => i.id)).toEqual([101, 102, 103, 104]);
    });

    it("does not duplicate first-page items on a repeated first-page load", async () => {
      vi.mocked(globalThis.$fetch).mockResolvedValue({
        items: pageOne,
        total: 2,
        nextOffset: null,
      });
      state.items = pageOne as never;
      await feed.loadItems({ offset: 0 });
      expect(state.items).toHaveLength(2);
    });

    it("deduplicates items with overlapping ids when appending a subsequent page", async () => {
      vi.mocked(globalThis.$fetch).mockResolvedValue({
        items: [item({ id: 102 }), item({ id: 103 })],
        total: 3,
        nextOffset: null,
      });
      state.items = pageOne as never;
      await feed.loadItems({ offset: 1 });
      expect(state.items.map((i) => i.id)).toEqual([101, 102, 103]);
    });
  });

  describe("sync queue integration", () => {
    let queueAction: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      queueAction = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal(
        "useSyncQueue",
        vi.fn(() => ({ queueAction })),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("toggleSave", () => {
      it("enqueues a save action with savedAt when saving", async () => {
        const feedItem = state.items[0];
        feedItem.saved = false;
        feedItem.feedId = 10;
        feedItem.guid = "guid-save";

        await feed.toggleSave(feedItem);

        expect(queueAction).toHaveBeenCalledOnce();
        const [action, payload] = queueAction.mock.calls[0];
        expect(action).toBe("save");
        expect(payload.feedId).toBe(10);
        expect(payload.guid).toBe("guid-save");
        expect(typeof payload.savedAt).toBe("string");
      });

      it("enqueues a save action with savedAt=null when unsaving", async () => {
        const feedItem = state.items[0];
        feedItem.saved = true;
        feedItem.feedId = 10;
        feedItem.guid = "guid-unsave";

        await feed.toggleSave(feedItem);

        expect(queueAction).toHaveBeenCalledOnce();
        const [action, payload] = queueAction.mock.calls[0];
        expect(action).toBe("save");
        expect(payload.feedId).toBe(10);
        expect(payload.guid).toBe("guid-unsave");
        expect(payload.savedAt).toBeNull();
      });
    });

    describe("toggleStar", () => {
      it("enqueues a star action with starred=true when starring", async () => {
        const feedItem = state.items[0];
        feedItem.starred = false;
        feedItem.feedId = 20;
        feedItem.guid = "guid-star";

        await feed.toggleStar(feedItem);

        expect(queueAction).toHaveBeenCalledOnce();
        const [action, payload] = queueAction.mock.calls[0];
        expect(action).toBe("star");
        expect(payload.feedId).toBe(20);
        expect(payload.guid).toBe("guid-star");
        expect(payload.starred).toBe(true);
      });

      it("enqueues a star action with starred=false when unstarring", async () => {
        const feedItem = state.items[0];
        feedItem.starred = true;
        feedItem.feedId = 20;
        feedItem.guid = "guid-unstar";

        await feed.toggleStar(feedItem);

        const [action, payload] = queueAction.mock.calls[0];
        expect(action).toBe("star");
        expect(payload.starred).toBe(false);
      });
    });

    describe("markAllRead", () => {
      it("enqueues a markRead action only for items that were unread", async () => {
        state.items = [
          item({ feedId: 1, guid: "g1", unread: true }),
          item({ feedId: 2, guid: "g2", unread: false }),
          item({ feedId: 3, guid: "g3", unread: true }),
        ];

        await feed.markAllRead();

        expect(queueAction).toHaveBeenCalledTimes(2);

        const calls = queueAction.mock.calls;
        expect(calls[0][0]).toBe("markRead");
        expect(calls[0][1].feedId).toBe(1);
        expect(calls[0][1].guid).toBe("g1");
        expect(typeof calls[0][1].readAt).toBe("string");

        expect(calls[1][1].feedId).toBe(3);
        expect(calls[1][1].guid).toBe("g3");
      });

      it("does not enqueue any markRead actions when all items are already read", async () => {
        state.items = [
          item({ feedId: 1, guid: "g1", unread: false }),
          item({ feedId: 2, guid: "g2", unread: false }),
        ];

        await feed.markAllRead();

        expect(queueAction).not.toHaveBeenCalled();
      });
    });

    describe("openItem", () => {
      it("enqueues a markRead action when item was unread", async () => {
        const feedItem = state.items[0];
        feedItem.unread = true;
        feedItem.feedId = 42;
        feedItem.guid = "guid-open";

        await feed.openItem(feedItem);

        expect(queueAction).toHaveBeenCalledOnce();
        const [action, payload] = queueAction.mock.calls[0];
        expect(action).toBe("markRead");
        expect(payload.feedId).toBe(42);
        expect(payload.guid).toBe("guid-open");
        expect(typeof payload.readAt).toBe("string");
      });

      it("does not enqueue a markRead action when item was already read", async () => {
        const feedItem = state.items[0];
        feedItem.unread = false;
        feedItem.feedId = 42;
        feedItem.guid = "guid-already-read";

        await feed.openItem(feedItem);

        expect(queueAction).not.toHaveBeenCalled();
      });
    });
  });
});
