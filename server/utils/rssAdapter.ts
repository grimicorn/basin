import RssParser from "rss-parser";
import type { InferInsertModel } from "drizzle-orm";
import { feedItems } from "../db/schema";
import { MAX_ITEMS_PER_SYNC } from "../../netlify/functions/types";

export type NewFeedItem = Omit<
  InferInsertModel<typeof feedItems>,
  "id" | "createdAt" | "updatedAt"
>;

const parser = new RssParser({
  timeout: 10_000,
});

function hashString(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    const character = input.charCodeAt(index);
    hash = (hash << 5) - hash + character;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function resolveGuid(
  itemGuid: string | undefined,
  itemLink: string | undefined,
): string {
  if (itemGuid) {
    return itemGuid;
  }

  if (itemLink) {
    return hashString(itemLink);
  }

  return hashString(String(Date.now()) + Math.random());
}

function resolvePublishedAt(
  isoDate: string | undefined,
  pubDate: string | undefined,
): Date | null {
  const raw = isoDate ?? pubDate;
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function resolveImageUrl(
  item: RssParser.Item,
  feedImageUrl: string | undefined,
): string | null {
  if (item.enclosure?.type?.startsWith("image/")) {
    return item.enclosure.url ?? null;
  }

  if (feedImageUrl) {
    return feedImageUrl;
  }

  return null;
}

function mapItemToFeedItem(
  item: RssParser.Item,
  feedId: number,
  feedTitle: string | undefined,
  feedImageUrl: string | undefined,
): NewFeedItem {
  const guid = resolveGuid(item.guid, item.link);
  const publishedAt = resolvePublishedAt(item.isoDate, item.pubDate);
  const author = item.creator ?? feedTitle ?? null;
  const content = item.contentSnippet ?? item.content ?? null;
  const imageUrl = resolveImageUrl(item, feedImageUrl);

  return {
    feedId,
    guid,
    title: item.title ?? "(untitled)",
    url: item.link ?? null,
    author,
    content,
    imageUrl,
    publishedAt,
    savedAt: new Date(),
    readAt: null,
    starred: false,
    tags: null,
    searchVector: null,
  };
}

export async function parseRssFeed(
  url: string,
  feedId: number,
): Promise<NewFeedItem[]> {
  const feed = await parser.parseURL(url);
  const feedImageUrl = feed.image?.url;

  const recentItems = (feed.items ?? []).slice(0, MAX_ITEMS_PER_SYNC);

  return recentItems.map((item) =>
    mapItemToFeedItem(item, feedId, feed.title, feedImageUrl),
  );
}

export async function parseRssFeedFromXml(
  xml: string,
  feedId: number,
  feedTitle?: string,
): Promise<NewFeedItem[]> {
  const feed = await parser.parseString(xml);
  const feedImageUrl = feed.image?.url;

  const recentItems = (feed.items ?? []).slice(0, MAX_ITEMS_PER_SYNC);

  return recentItems.map((item) =>
    mapItemToFeedItem(item, feedId, feedTitle ?? feed.title, feedImageUrl),
  );
}
