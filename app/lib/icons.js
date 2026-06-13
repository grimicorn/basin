/* Reader — icon, source-meta & logo-mark maps (ESM) */
export const ICONS = {
  // UI — 24x24 stroke icons
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
  bookmarkFill:
    '<path d="M6 4h12v17l-6-4-6 4V4Z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 6.5"/>',
  checkAll:
    '<path d="M4 12.5l4 4L15 7"/><path d="M11 16.5l1 1L21 7" opacity="0.55"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevDown: '<path d="M5 9l7 7 7-7"/>',
  chevRight: '<path d="M9 5l7 7-7 7"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.4 6.4 0 0 0 20 14.5Z"/>',
  monitor:
    '<rect x="3" y="4.5" width="18" height="12" rx="1.6"/><path d="M9 20h6M12 16.5V20"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.3"/><rect x="13" y="4" width="7" height="7" rx="1.3"/><rect x="4" y="13" width="7" height="7" rx="1.3"/><rect x="13" y="13" width="7" height="7" rx="1.3"/>',
  columns:
    '<rect x="3.5" y="4.5" width="5" height="15" rx="1.3"/><rect x="9.5" y="4.5" width="5" height="15" rx="1.3"/><rect x="15.5" y="4.5" width="5" height="15" rx="1.3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-1.8 6"/><path d="M20 4v6h-6"/>',
  external:
    '<path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  play: '<path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none"/>',
  playCircle:
    '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5-5.5-3.5Z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" stroke="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
  rss: '<path d="M5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor" stroke="none"/><path d="M4.5 10.5A9 9 0 0 1 13.5 19.5M4.5 5A14.5 14.5 0 0 1 19 19.5"/>',
  photo:
    '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M5 17l4.5-4 3 2.5L16 11l4 4.5"/>',
  chat: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1Z"/>',
  video:
    '<rect x="3.5" y="6" width="13" height="12" rx="2"/><path d="M16.5 10l4-2.5v9l-4-2.5"/>',
  dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  logout:
    '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 12h10M16 8l4 4-4 4"/>',
  link: '<path d="M9 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5M15 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5"/>',
  trash:
    '<path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 13h8l1-13"/>',
  sparkle:
    '<path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6L12 4Z"/>',
  inbox:
    '<path d="M4 13h4l1.5 3h5L16 13h4M4 13l3-8h10l3 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z"/>',
  hash: '<path d="M9 4l-1.5 16M16.5 4L15 20M5 9h15M4 15h15"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  heart:
    '<path d="M12 20s-7-4.6-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.5C19 15.4 12 20 12 20Z"/>',
  repost:
    '<path d="M5 9l3-3 3 3M8 6v8a2 2 0 0 0 2 2h6M19 15l-3 3-3-3M16 18v-8a2 2 0 0 0-2-2H8"/>',
};

// source meta
export const SOURCES = {
  article: { icon: "rss", label: "RSS", cls: "src-rss" },
  podcast: { icon: "mic", label: "Podcast", cls: "src-podcast" },
  video: { icon: "video", label: "YouTube", cls: "src-video" },
  tweet: { icon: "chat", label: "Bluesky", cls: "src-tweet" },
  photo: { icon: "photo", label: "Instagram", cls: "src-photo" },
};

// Logo marks (64x64 inner svg). Default mark = "stack" (aggregated feed).
export const LOGO_MARKS = {
  stack:
    '<rect x="14" y="16" width="36" height="9" rx="4.5" style="fill:var(--accent-strong)" opacity="0.45"/><rect x="11" y="28" width="42" height="9" rx="4.5" style="fill:var(--accent-strong)" opacity="0.72"/><rect x="16" y="40" width="32" height="9" rx="4.5" style="fill:var(--accent)"/>',
  peakLines:
    '<path d="M32 14 L52 50 H12 Z" style="fill:var(--accent)"/><rect x="29" y="30" width="6" height="3" rx="1.5" style="fill:var(--logo-cut,#fff)"/><rect x="25" y="38" width="14" height="3" rx="1.5" style="fill:var(--logo-cut,#fff)"/><rect x="21" y="44" width="22" height="3" rx="1.5" style="fill:var(--logo-cut,#fff)"/>',
  peaks:
    '<path d="M20 50 L34 22 L48 50 Z" style="fill:var(--accent-strong)" opacity="0.55"/><path d="M8 50 L24 18 L40 50 Z" style="fill:var(--accent)"/>',
};
