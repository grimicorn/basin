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

function guidFromItem(item: ParserItem): string {
  if (item.guid) return item.guid;
  if (item.link) return createHash("sha256").update(item.link).digest("hex");
  return createHash("sha256")
    .update((item.title ?? "") + (item.isoDate ?? ""))
    .digest("hex");
}

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
