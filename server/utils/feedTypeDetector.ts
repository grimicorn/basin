// Number of items to inspect when checking for audio enclosures.
// Sampling the first few items is reliable for well-formed podcast feeds
// without walking the entire document.
const ITEM_SAMPLE_SIZE = 5;

// Audio/video MIME types that signal a podcast feed.
const AUDIO_VIDEO_MIME_PATTERN = /^(audio|video)\//i;

// File extensions used by common audio formats when the MIME type is generic
// or absent. The lookahead (?:$|[?#]) ensures URLs with query strings or hash
// fragments (e.g. episode.mp3?download=1) are matched correctly.
const AUDIO_EXTENSION_PATTERN =
  /\.(mp3|m4a|aac|ogg|opus|flac|wav|mp4|m4v)(?:$|[?#])/i;

// iTunes namespace prefix present in podcast feeds.
const ITUNES_NAMESPACE_PATTERN = /xmlns:itunes/i;

// iTunes episode-level tags that corroborate podcast classification.
const ITUNES_EPISODE_PATTERN =
  /<itunes:(?:duration|episode|season|episodeType)[^>]*>/i;

// RSS <item> element — used to split the feed body into individual items.
const RSS_ITEM_PATTERN = /<item\b[^>]*>[\s\S]*?<\/item>/gi;

// Atom <entry> element — used to split the feed body into individual entries.
const ATOM_ENTRY_PATTERN = /<entry\b[^>]*>[\s\S]*?<\/entry>/gi;

// RSS <enclosure> tag — captures type and url attributes in any order.
const RSS_ENCLOSURE_PATTERN = /<enclosure\b[^>]*>/gi;

// Atom <link rel="enclosure"> — captures type and href attributes.
const ATOM_ENCLOSURE_LINK_PATTERN = /<link\b[^>]*rel=["']enclosure["'][^>]*>/gi;

// Extract an attribute value from a tag string.
function extractAttribute(tag: string, attribute: string): string {
  const pattern = new RegExp(`\\b${attribute}=["']([^"']*)["']`, "i");
  return pattern.exec(tag)?.[1] ?? "";
}

function isAudioVideoMimeType(mimeType: string): boolean {
  return AUDIO_VIDEO_MIME_PATTERN.test(mimeType);
}

function hasAudioExtension(url: string): boolean {
  return AUDIO_EXTENSION_PATTERN.test(url);
}

// Returns true when the enclosure tag represents an audio or video resource.
// Checks the MIME type first; falls back to the file extension when the MIME
// type is absent, empty, or a non-audio/video type (e.g. application/octet-stream).
function enclosureIsAudioOrVideo(tag: string, urlAttr: string): boolean {
  const mimeType = extractAttribute(tag, "type");

  if (isAudioVideoMimeType(mimeType)) return true;

  // Fall back to extension when MIME is absent or unhelpful.
  const enclosureUrl = extractAttribute(tag, urlAttr);
  return hasAudioExtension(enclosureUrl);
}

function sampleItems(body: string, pattern: RegExp): string[] {
  const matches = body.match(pattern) ?? [];
  return matches.slice(0, ITEM_SAMPLE_SIZE);
}

function hasRssAudioEnclosure(body: string): boolean {
  const sampledItems = sampleItems(body, RSS_ITEM_PATTERN);
  return sampledItems.some((item) => {
    const enclosureTags = item.match(RSS_ENCLOSURE_PATTERN) ?? [];
    return enclosureTags.some((tag) => enclosureIsAudioOrVideo(tag, "url"));
  });
}

function hasAtomAudioEnclosure(body: string): boolean {
  const sampledEntries = sampleItems(body, ATOM_ENTRY_PATTERN);
  return sampledEntries.some((entry) => {
    const enclosureTags = entry.match(ATOM_ENCLOSURE_LINK_PATTERN) ?? [];
    return enclosureTags.some((tag) => enclosureIsAudioOrVideo(tag, "href"));
  });
}

function hasItunesEpisodeTags(body: string): boolean {
  return (
    ITUNES_NAMESPACE_PATTERN.test(body) && ITUNES_EPISODE_PATTERN.test(body)
  );
}

function hasPodcastSignal(body: string): boolean {
  return (
    hasRssAudioEnclosure(body) ||
    hasAtomAudioEnclosure(body) ||
    hasItunesEpisodeTags(body)
  );
}

export type FeedSourceType = "podcast" | "rss";

/**
 * Classifies a feed body as either "podcast" or "rss" based on its content.
 *
 * Detection rules (in priority order):
 *  1. Any <enclosure> with audio/* or video/* MIME type → podcast
 *  2. Any <enclosure> with a missing or generic MIME type but an audio file extension → podcast
 *  3. iTunes namespace + episode-level tags (<itunes:duration>, etc.) → podcast
 *  4. Anything else → rss
 */
export function detectFeedSourceType(body: string): FeedSourceType {
  return hasPodcastSignal(body) ? "podcast" : "rss";
}
