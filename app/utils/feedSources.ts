// Maps the feed-level source value (stored in the feeds table) to the
// item type key used by the front-end SOURCES map (icons.js).
// This is the single source of truth — import it on both the server and
// client sides so adding a new source type only requires one edit.
export const FEED_SOURCE_TO_ITEM_TYPE: Record<string, string> = {
  rss: "article",
  podcast: "podcast",
  video: "video",
  tweet: "tweet",
  photo: "photo",
  bluesky: "tweet",
};
