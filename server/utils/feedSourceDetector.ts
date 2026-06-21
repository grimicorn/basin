// How many items to inspect when scanning for audio enclosures.
// Sampling the first few items is sufficient and keeps detection cheap.
const ITEM_SAMPLE_LIMIT = 5;

// Audio/video MIME types that indicate a podcast enclosure.
const AUDIO_VIDEO_MIME_PATTERN = /^(audio|video)\//i;

// File extensions used for audio when the MIME type is generic or absent.
const AUDIO_EXTENSION_PATTERN =
  /\.(mp3|m4a|aac|ogg|opus|flac|wav|m4b|mp4a)($|\?)/i;

// iTunes namespace declaration — strong signal that this is a podcast feed.
const ITUNES_NAMESPACE_PATTERN = /xmlns:itunes\s*=/i;

// iTunes episode-level elements used as corroborating evidence.
const ITUNES_EPISODE_PATTERN = /<itunes:(duration|episode)[^>]*>/i;

// RSS 2.0 enclosure element: <enclosure url="…" type="audio/mpeg" …/>
const RSS_ENCLOSURE_PATTERN = /<enclosure[^>]+(?:url|type)=[^>]*/gi;

// Atom enclosure: <link rel="enclosure" href="…" type="audio/mpeg"/>
const ATOM_ENCLOSURE_PATTERN = /<link[^>]+rel=["']enclosure["'][^>]*/gi;

function extractAttribute(tag: string, attributeName: string): string {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = pattern.exec(tag);
  return match?.[1] ?? "";
}

function isAudioOrVideoMime(mimeType: string): boolean {
  if (!mimeType) {
    return false;
  }
  return AUDIO_VIDEO_MIME_PATTERN.test(mimeType);
}

function isAudioByExtension(url: string): boolean {
  return AUDIO_EXTENSION_PATTERN.test(url);
}

function hasAudioEnclosure(tagText: string): boolean {
  const mimeType = extractAttribute(tagText, "type");
  if (isAudioOrVideoMime(mimeType)) {
    return true;
  }

  if (mimeType && mimeType !== "application/octet-stream") {
    return false;
  }

  const url =
    extractAttribute(tagText, "url") || extractAttribute(tagText, "href");
  return isAudioByExtension(url);
}

function collectMatches(body: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    matches.push(match[0]);
    if (matches.length >= ITEM_SAMPLE_LIMIT) {
      break;
    }
  }

  pattern.lastIndex = 0;
  return matches;
}

function hasAudioRssEnclosure(body: string): boolean {
  const enclosureTags = collectMatches(body, RSS_ENCLOSURE_PATTERN);
  return enclosureTags.some(hasAudioEnclosure);
}

function hasAudioAtomEnclosure(body: string): boolean {
  const linkTags = collectMatches(body, ATOM_ENCLOSURE_PATTERN);
  return linkTags.some(hasAudioEnclosure);
}

function hasItunesSignals(body: string): boolean {
  return (
    ITUNES_NAMESPACE_PATTERN.test(body) && ITUNES_EPISODE_PATTERN.test(body)
  );
}

/**
 * Classifies a parsed feed XML body as "podcast" or "rss".
 *
 * Classified as "podcast" when:
 *   - Any sampled item carries an audio/* or video/* enclosure (RSS or Atom), OR
 *   - The feed declares the iTunes namespace AND uses episode-level iTunes elements.
 *
 * Everything else is classified as "rss".
 */
export function detectFeedSource(feedBody: string): "podcast" | "rss" {
  if (hasAudioRssEnclosure(feedBody)) {
    return "podcast";
  }

  if (hasAudioAtomEnclosure(feedBody)) {
    return "podcast";
  }

  if (hasItunesSignals(feedBody)) {
    return "podcast";
  }

  return "rss";
}
