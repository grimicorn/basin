/* Reader — mock sidebar data (ESM).
   Feed items are now loaded from the real API (GET /api/feed-items).
   Only feeds and connections remain here for the sidebar panel. */

export const feeds = [
  {
    id: "f1",
    type: "rss",
    name: "A Working Library",
    url: "workinglibrary.com/feed",
    count: 3,
    color: "var(--src-rss)",
    status: "ok",
  },
  {
    id: "f2",
    type: "rss",
    name: "The Verge",
    url: "theverge.com/rss/index.xml",
    count: 41,
    color: "var(--src-rss)",
    status: "ok",
  },
  {
    id: "f3",
    type: "rss",
    name: "Stratechery",
    url: "stratechery.com/feed",
    count: 2,
    color: "var(--src-rss)",
    status: "ok",
  },
  {
    id: "f4",
    type: "rss",
    name: "Obsidian Roundup",
    url: "obsidianroundup.org/rss",
    count: 1,
    color: "var(--src-rss)",
    status: "error",
  },
  {
    id: "p1",
    type: "podcast",
    name: "Syntax",
    url: "feeds.simplecast.com/syntax",
    count: 2,
    color: "var(--src-podcast)",
    status: "ok",
  },
  {
    id: "p2",
    type: "podcast",
    name: "Darknet Diaries",
    url: "feeds.megaphone.fm/darknet",
    count: 1,
    color: "var(--src-podcast)",
    status: "ok",
  },
];

export const connections = [
  {
    id: "youtube",
    name: "YouTube",
    desc: "Subscriptions & Watch Later",
    connected: true,
    account: "@you",
    color: "var(--src-video)",
    since: "Connected Apr 2026",
  },
  {
    id: "twitter",
    name: "X / Twitter",
    desc: "Home timeline & lists",
    connected: true,
    account: "@you",
    color: "var(--src-tweet)",
    since: "Connected Feb 2026",
  },
  {
    id: "instagram",
    name: "Instagram",
    desc: "Following feed",
    connected: false,
    account: "",
    color: "var(--src-photo)",
    since: "",
  },
];
