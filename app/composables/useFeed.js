/* useFeed — the app's content store (items, feeds, connections) plus all
   feed actions and the reader-detail state. Singleton reactive instance.
   Replace the mock seed + the action bodies with real API calls later. */
import { reactive, computed, watch } from "vue";
import {
  items as seedItems,
  feeds as seedFeeds,
  connections as seedConnections,
} from "~/data/mock";
import { SOURCES } from "~/lib/icons";

const clone = (x) => JSON.parse(JSON.stringify(x));

const state = reactive({
  items: clone(seedItems),
  feeds: clone(seedFeeds),
  connections: clone(seedConnections),
  filter: "all",
  layout: "timeline",
  unreadOnly: false,
  loading: true,
  revealDone: true,
  activeItem: null,
  detailLoading: false,
  newFeedUrl: "",
});

let timers = { load: null, reveal: null, detail: null };
let initialized = false;

/* ---------- computeds (created once) ---------- */
const filterDefs = [
  { id: "all", label: "All", c: "var(--accent)" },
  { id: "article", label: "RSS", c: "var(--src-rss)" },
  { id: "podcast", label: "Podcasts", c: "var(--src-podcast)" },
  { id: "video", label: "YouTube", c: "var(--src-video)" },
  { id: "tweet", label: "X", c: "var(--src-tweet)" },
  { id: "photo", label: "Instagram", c: "var(--src-photo)" },
  { id: "saved", label: "Saved", c: "var(--accent)" },
];

const unreadCount = computed(() => state.items.filter((i) => i.unread).length);

const visibleItems = computed(() => {
  let list = state.items;
  if (state.unreadOnly) list = list.filter((i) => i.unread);
  if (state.filter === "saved") return list.filter((i) => i.saved);
  if (state.filter !== "all")
    return list.filter((i) => i.type === state.filter);
  return list;
});

const decks = computed(() => {
  const order = ["article", "podcast", "video", "tweet", "photo"];
  return order
    .map((t) => ({
      type: t,
      meta: SOURCES[t],
      items: state.items.filter((i) => i.type === t),
    }))
    .filter((d) => d.items.length);
});

const skeletonKinds = [
  "article",
  "video",
  "tweet",
  "podcast",
  "photo",
  "article",
];

export function useFeed() {
  const { showToast } = useToast();

  async function loadSettingsFromDb() {
    const { load } = useUserSettings();
    const settings = await load();
    state.layout = settings.layout ?? "timeline";
    state.unreadOnly = settings.showUnreadOnly ?? false;
  }

  function setupWatchers() {
    if (initialized || !import.meta.client) return;
    initialized = true;

    loadSettingsFromDb();

    watch(
      () => state.layout,
      (layout) => {
        const { save } = useUserSettings();
        save({ layout });
        runFeedLoad(380);
      },
    );
    watch(
      () => state.unreadOnly,
      (showUnreadOnly) => {
        const { save } = useUserSettings();
        save({ showUnreadOnly });
      },
    );
    watch(
      () => state.filter,
      () => runFeedLoad(420),
    );
    // first paint
    setTimeout(() => {
      state.loading = false;
    }, 650);
  }

  function runFeedLoad(ms = 650) {
    state.loading = true;
    state.revealDone = false;
    clearTimeout(timers.load);
    timers.load = setTimeout(() => {
      state.loading = false;
      clearTimeout(timers.reveal);
      timers.reveal = setTimeout(() => {
        state.revealDone = true;
      }, 950);
    }, ms);
  }

  function refresh() {
    runFeedLoad(800);
    showToast("Checking all feeds…");
  }

  const countFor = (id) => {
    if (id === "all") return state.items.length;
    if (id === "saved") return state.items.filter((i) => i.saved).length;
    return state.items.filter((i) => i.type === id).length;
  };

  function toggleSave(item) {
    item.saved = !item.saved;
    showToast(item.saved ? "Saved for later" : "Removed from saved");
  }

  function markAllRead() {
    state.items.forEach((i) => {
      i.unread = false;
    });
    showToast("Marked all as read");
  }

  function openItem(item) {
    item.unread = false;
    state.activeItem = item;
    state.detailLoading = true;
    clearTimeout(timers.detail);
    timers.detail = setTimeout(() => {
      state.detailLoading = false;
    }, 520);
    if (import.meta.client) document.body.style.overflow = "hidden";
  }

  function closeDetail() {
    state.activeItem = null;
    if (import.meta.client) document.body.style.overflow = "";
  }

  function detailNav(dir) {
    const list = visibleItems.value;
    if (!state.activeItem || !list.length) return;
    let idx = list.findIndex((i) => i.id === state.activeItem.id);
    if (idx === -1) return;
    idx = (idx + dir + list.length) % list.length;
    openItem(list[idx]);
  }

  function addFeed() {
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

  function removeFeed(id) {
    state.feeds = state.feeds.filter((f) => f.id !== id);
    showToast("Feed removed");
  }

  function toggleConn(c) {
    c.connected = !c.connected;
    c.since = c.connected ? "Connected just now" : "";
    showToast(c.connected ? `${c.name} connected` : `${c.name} disconnected`);
  }

  const cardComponentName = (type) =>
    ({
      article: "ArticleCard",
      video: "VideoCard",
      podcast: "PodcastCard",
      tweet: "TweetCard",
      photo: "PhotoCard",
    })[type];

  /* synthesized detail content (falls back when an item lacks an authored body) */
  const articleBody = (item) =>
    item.body && item.body.length
      ? item.body
      : [
          item.excerpt,
          "Read the full piece at the source for the complete story, figures, and links.",
        ];
  const podcastNotes = (item) =>
    item.notes && item.notes.length
      ? item.notes
      : [item.excerpt || "Episode notes weren't provided for this show."];
  const videoDesc = (item) =>
    item.desc ||
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
  const photoComments = () => [
    { who: "northern.light", text: "the light here is unreal 🔥" },
    { who: "wanderframe", text: "saving this for inspiration" },
  ];

  const sourceMeta = (type) => SOURCES[type];

  return {
    state,
    filterDefs,
    unreadCount,
    visibleItems,
    decks,
    skeletonKinds,
    countFor,
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
    photoComments,
    sourceMeta,
  };
}
