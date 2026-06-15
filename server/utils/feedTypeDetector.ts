// Number of items to inspect when checking for audio enclosures.
// Sampling the first few items is reliable for well-formed podcast feeds
// without walking the entire document.
const ITEM_SAMPLE_SIZE = 5;

// Audio/video MIME types that signal a podcast feed.
const AUDIO_VIDEO_MIME_PATTERN = /^(audio|video)\//i;

// File extensions used by common audio formats when the MIME type is generic.
const AUDIO_EXTENSION_PATTERN = /\.(mp3|m4a|aac|ogg|opus|flac|wav|mp4|m4v)$/i;

// iTunes namespace prefix present in podcast feeds.
const ITUNES_NAMESPACE_PATTERN = /xmlns:itunes/i;

// iTunes episode-level tags that corroborate podcast classification.
const ITUNES_EPISODE_PATTERN =
  /<itunes:(?:duration|episode|season|episodeType)[^>]*>/i;

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

function enclosureIsAudioOrVideo(tag: string, urlAttr: string): boolean {
  const mimeType = extractAttribute(tag, "type");
  if (isAudioVideoMimeType(mimeType)) return true;

  // Some feeds use generic MIME types (e.g. application/octet-stream) —
  // fall back to the file extension when the MIME type is unhelpful.
  if (mimeType && !isAudioVideoMimeType(mimeType)) {
    const enclosureUrl = extractAttribute(tag, urlAttr);
    return hasAudioExtension(enclosureUrl);
  }

  return false;
}

function hasRssAudioEnclosure(body: string): boolean {
  const matches = body.match(RSS_ENCLOSURE_PATTERN) ?? [];
  const sampleMatches = matches.slice(0, ITEM_SAMPLE_SIZE);
  return sampleMatches.some((tag) => enclosureIsAudioOrVideo(tag, "url"));
}

function hasAtomAudioEnclosure(body: string): boolean {
  const matches = body.match(ATOM_ENCLOSURE_LINK_PATTERN) ?? [];
  const sampleMatches = matches.slice(0, ITEM_SAMPLE_SIZE);
  return sampleMatches.some((tag) => enclosureIsAudioOrVideo(tag, "href"));
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
 *  2. Any <enclosure> with a generic MIME type but an audio file extension → podcast
 *  3. iTunes namespace + episode-level tags (<itunes:duration>, etc.) → podcast
 *  4. Anything else → rss
 */
export function detectFeedSourceType(body: string): FeedSourceType {
  return hasPodcastSignal(body) ? "podcast" : "rss";
}
