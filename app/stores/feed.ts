import { defineStore } from "pinia";
import { reactive, computed } from "vue";
import {
  feeds as seedFeeds,
  connections as seedConnections,
} from "~/data/mock";
import { SOURCES } from "~/lib/icons";

const clone = (x: unknown) => JSON.parse(JSON.stringify(x));

export const useFeedStore = defineStore("feed", () => {
  const state = reactive({
    items: [] as Record<string, unknown>[],
    feeds: clone(seedFeeds),
    connections: clone(seedConnections),
    filter: "all",
    layout: "timeline",
    unreadOnly: false,
    loading: true,
    revealDone: true,
    activeItem: null as Record<string, unknown> | null,
    detailLoading: false,
    newFeedUrl: "",
  });

  const timers: Record<string, ReturnType<typeof setTimeout> | null> = {
    load: null,
    reveal: null,
    detail: null,
  };
  let initialized = false;

  const filterDefs = [
    { id: "all", label: "All", c: "var(--accent)" },
    { id: "article", label: "RSS", c: "var(--src-rss)" },
    { id: "podcast", label: "Podcasts", c: "var(--src-podcast)" },
    { id: "video", label: "YouTube", c: "var(--src-video)" },
    { id: "tweet", label: "Bluesky", c: "var(--src-tweet)" },
    { id: "saved", label: "Saved", c: "var(--accent)" },
  ];

  const skeletonKinds = ["article", "video", "tweet", "podcast", "article"];

  const unreadCount = computed(
    () => state.items.filter((i: Record<string, unknown>) => i.unread).length,
  );

  const visibleItems = computed(() => {
    let list = state.items;
    if (state.unreadOnly)
      list = list.filter((i: Record<string, unknown>) => i.unread);
    if (state.filter === "saved")
      return list.filter((i: Record<string, unknown>) => i.saved);
    if (state.filter !== "all")
      return list.filter(
        (i: Record<string, unknown>) => i.type === state.filter,
      );
    return list;
  });

  const decks = computed(() => {
    const order = ["article", "podcast", "video", "tweet"];
    return order
      .map((t) => ({
        type: t,
        meta: SOURCES[t as keyof typeof SOURCES],
        items: state.items.filter((i: Record<string, unknown>) => i.type === t),
      }))
      .filter((d) => d.items.length);
  });

  async function loadSettingsFromDb() {
    const { load } = useUserSettings();
    const settings = await load();
    state.layout = settings.layout ?? "timeline";
    state.unreadOnly = settings.showUnreadOnly ?? false;
  }

  async function loadItems(params: { limit?: number; offset?: number } = {}) {
    const { getToken } = useAuth();
    const token = await getToken.value();
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const query: Record<string, string> = {};
    if (params.limit !== undefined) {
      query.limit = String(params.limit);
    }
    if (params.offset !== undefined) {
      query.offset = String(params.offset);
    }

    const response = await $fetch<{
      items: Record<string, unknown>[];
      total: number;
      nextOffset: number | null;
    }>("/api/feed-items", { headers, query });

    if ((params.offset ?? 0) > 0) {
      const seen = new Set(state.items.map((i) => i.id));
      state.items = [
        ...state.items,
        ...response.items.filter((i) => !seen.has(i.id)),
      ];
    } else {
      state.items = response.items;
    }
  }

  async function setupWatchers() {
    if (initialized || !import.meta.client) return;
    initialized = true;

    const { save } = useUserSettings();
    await loadSettingsFromDb();

    watch(
      () => state.layout,
      (layout: string) => {
        save({ layout });
        runFeedLoad(380);
      },
    );
    watch(
      () => state.unreadOnly,
      (showUnreadOnly: boolean) => {
        save({ showUnreadOnly });
      },
    );
    watch(
      () => state.filter,
      () => runFeedLoad(420),
    );
    setTimeout(() => {
      state.loading = false;
    }, 650);
  }

  function runFeedLoad(ms = 650) {
    state.loading = true;
    state.revealDone = false;
    if (timers.load) clearTimeout(timers.load);
    timers.load = setTimeout(() => {
      state.loading = false;
      if (timers.reveal) clearTimeout(timers.reveal);
      timers.reveal = setTimeout(() => {
        state.revealDone = true;
      }, 950);
    }, ms);
  }

  function refresh() {
    const { showToast } = useToast();
    runFeedLoad(800);
    showToast("Checking all feeds…");
  }

  function countFor(id: string) {
    if (id === "all") return state.items.length;
    if (id === "saved")
      return state.items.filter((i: Record<string, unknown>) => i.saved).length;
    return state.items.filter((i: Record<string, unknown>) => i.type === id)
      .length;
  }

  function toggleSave(item: Record<string, unknown>) {
    const { showToast } = useToast();
    item.saved = !item.saved;
    showToast(item.saved ? "Saved for later" : "Removed from saved");
  }

  function markAllRead() {
    const { showToast } = useToast();
    state.items.forEach((i: Record<string, unknown>) => {
      i.unread = false;
    });
    showToast("Marked all as read");
  }

  function openItem(item: Record<string, unknown>) {
    item.unread = false;
    state.activeItem = item;
    state.detailLoading = true;
    if (timers.detail) clearTimeout(timers.detail);
    timers.detail = setTimeout(() => {
      state.detailLoading = false;
    }, 520);
    if (import.meta.client) document.body.style.overflow = "hidden";
  }

  function closeDetail() {
    state.activeItem = null;
    if (import.meta.client) document.body.style.overflow = "";
  }

  function detailNav(dir: number) {
    const list = visibleItems.value;
    if (!state.activeItem || !list.length) return;
    let idx = list.findIndex(
      (i: Record<string, unknown>) => i.id === state.activeItem!.id,
    );
    if (idx === -1) return;
    idx = (idx + dir + list.length) % list.length;
    openItem(list[idx]);
  }

  function addFeed() {
    const { showToast } = useToast();
    const url = state.newFeedUrl.trim();
    if (!url) return;
    const isPod = /podcast|simplecast|megaphone|\.mp3|audio/i.test(url);
    state.feeds.unshift({
      id: "n" + Date.now(),
      type: isPod ? "podcast" : "rss",
      name: url.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
      url: url.replace(/^https?:\/\//, ""),
      count: 0,
      color: isPod ? "var(--src-podcast)" : "var(--src-rss)",
      status: "ok",
    });
    state.newFeedUrl = "";
    showToast("Feed added · fetching latest");
  }

  function removeFeed(id: string) {
    const { showToast } = useToast();
    state.feeds = state.feeds.filter(
      (f: Record<string, unknown>) => f.id !== id,
    );
    showToast("Feed removed");
  }

  function toggleConn(c: Record<string, unknown>) {
    const { showToast } = useToast();
    c.connected = !c.connected;
    c.since = c.connected ? "Connected just now" : "";
    showToast(c.connected ? `${c.name} connected` : `${c.name} disconnected`);
  }

  const cardComponentName = (type: string) =>
    ({
      article: "ArticleCard",
      video: "VideoCard",
      podcast: "PodcastCard",
      tweet: "TweetCard",
    })[type];

  const articleBody = (item: Record<string, unknown>) =>
    item.body && (item.body as unknown[]).length
      ? (item.body as string[])
      : [
          item.excerpt as string,
          "Read the full piece at the source for the complete story, figures, and links.",
        ];

  const podcastNotes = (item: Record<string, unknown>) =>
    item.notes && (item.notes as unknown[]).length
      ? (item.notes as string[])
      : [
          (item.excerpt as string) ||
            "Episode notes weren't provided for this show.",
        ];

  const videoDesc = (item: Record<string, unknown>) =>
    (item.desc as string) ||
    `${item.title} — watch the full video on the channel. ${item.views || ""}.`;

  const tweetReplies = () => [
    {
      who: "replyguy",
      handle: "@in_the_replies",
      text: "this is going straight into my notes app, thank you",
      likes: "12",
    },
    {
      who: "Builder",
      handle: "@ships_daily",
      text: "needed to read this today honestly",
      likes: "4",
    },
  ];

  const sourceMeta = (type: string) => SOURCES[type as keyof typeof SOURCES];

  return {
    state,
    filterDefs,
    skeletonKinds,
    unreadCount,
    visibleItems,
    decks,
    countFor,
    loadItems,
    setupWatchers,
    runFeedLoad,
    refresh,
    toggleSave,
    markAllRead,
    openItem,
    closeDetail,
    detailNav,
    addFeed,
    removeFeed,
    toggleConn,
    cardComponentName,
    articleBody,
    podcastNotes,
    videoDesc,
    tweetReplies,
    sourceMeta,
  };
});
