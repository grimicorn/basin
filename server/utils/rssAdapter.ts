import Parser from "rss-parser";
import { createHash } from "node:crypto";

// Cap initial backfill so first sync of a large feed doesn't balloon the DB.
const MAX_ITEMS_PER_SYNC = 50;

export type RssFeedItem = {
  feedId: number;
  guid: string;
  title: string;
  url: string | null;
  author: string | null;
  imageUrl: string | null;
  content: string | null;
  publishedAt: Date | null;
  savedAt: Date;
};

type ParserItem = Parser.Item & {
  "media:thumbnail"?: { $?: { url?: string } };
  "media:content"?: { $?: { url?: string } };
};

const parser = new Parser<Record<string, unknown>, ParserItem>({
  customFields: {
    item: [
      ["media:thumbnail", "media:thumbnail"],
      ["media:content", "media:content"],
    ],
  },
});

/**
 * Derives a stable GUID for an RSS item.
 *
 * @returns The item's stable GUID.
 */
function guidFromItem(item: ParserItem): string {
  if (item.guid) return item.guid;
  if (item.link) return createHash("sha256").update(item.link).digest("hex");
  return createHash("sha256")
    .update((item.title ?? "") + (item.isoDate ?? ""))
    .digest("hex");
}

/**
 * Extracts an image URL from an RSS item.
 *
 * @returns The image URL if found, `null` otherwise.
 */
function imageUrlFromItem(item: ParserItem): string | null {
  const thumbnail = item["media:thumbnail"]?.["$"]?.url;
  if (thumbnail) return thumbnail;

  const mediaContent = item["media:content"]?.["$"]?.url;
  if (mediaContent) return mediaContent;

  const enclosure = item.enclosure?.url;
  if (enclosure && /\.(jpg|jpeg|png|gif|webp)/i.test(enclosure))
    return enclosure;

  return null;
}

/**
 * Extracts the publication date from an RSS item.
 *
 * @returns A Date object if a valid publication date is found, `null` otherwise.
 */
function publishedAtFromItem(item: ParserItem): Date | null {
  if (item.isoDate) {
    const parsed = new Date(item.isoDate);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (item.pubDate) {
    const parsed = new Date(item.pubDate);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Converts a parsed RSS item into a normalized feed item record.
 *
 * @returns A normalized `RssFeedItem`.
 */
function mapItemToFeedItem(
  item: ParserItem,
  feedId: number,
  feedTitle: string | undefined,
): RssFeedItem {
  return {
    feedId,
    guid: guidFromItem(item),
    title: item.title ?? "Untitled",
    url: item.link ?? null,
    author: item.creator ?? item["dc:creator"] ?? feedTitle ?? null,
    imageUrl: imageUrlFromItem(item),
    content: item.contentSnippet ?? item.content ?? null,
    publishedAt: publishedAtFromItem(item),
    savedAt: new Date(),
  };
}

export type FetchRssItemsFn = (
  _feedUrl: string,
) => Promise<{ items: RssFeedItem[]; feedTitle: string | undefined }>;

export type RssParserFn = (
  _url: string,
) => Promise<Parser.Output<ParserItem> & { items: ParserItem[] }>;

/**
 * Creates a function that fetches and normalizes RSS feed items.
 *
 * @param parseFn - Optional custom RSS parser function. Defaults to the module's shared parser.
 * @returns A function that takes a feed URL and returns an object containing normalized items and optional feed title.
 */
export function createRssAdapter(
  parseFn: RssParserFn = (url) =>
    parser.parseURL(url) as Promise<
      Parser.Output<ParserItem> & { items: ParserItem[] }
    >,
): FetchRssItemsFn {
  return async (feedUrl: string) => {
    const feed = await parseFn(feedUrl);
    const items = (feed.items ?? [])
      .slice(0, MAX_ITEMS_PER_SYNC)
      .map((item) => mapItemToFeedItem(item, 0, feed.title));
    return { items, feedTitle: feed.title };
  };
}

export const defaultRssAdapter = createRssAdapter();

/**
 * Fetches RSS items from a feed URL and assigns them to the specified feed.
 *
 * @param feedId - The feed ID to assign to each item.
 * @returns An object containing the feed's items with the assigned feed ID and the feed's title.
 */
export async function fetchRssItemsForFeed(
  feedUrl: string,
  feedId: number,
  parseFn?: RssParserFn,
): Promise<{ items: RssFeedItem[]; feedTitle: string | undefined }> {
  const adapter = parseFn ? createRssAdapter(parseFn) : defaultRssAdapter;
  const result = await adapter(feedUrl);

  const itemsWithFeedId = result.items.map((item) => ({
    ...item,
    feedId,
  }));

  return { items: itemsWithFeedId, feedTitle: result.feedTitle };
}
