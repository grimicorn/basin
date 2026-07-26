import RssParser from "rss-parser";
import type { InferInsertModel } from "drizzle-orm";
import { feedItems } from "../db/schema";
import { MAX_ITEMS_PER_SYNC } from "../../netlify/functions/types";
import { resolvePublicFeedUrl } from "./urlValidator";

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

function resolveGuid(item: RssParser.Item): string {
  if (item.guid) {
    return item.guid;
  }

  if (item.link) {
    return hashString(item.link);
  }

  const stableSeed = [
    item.title ?? "",
    item.isoDate ?? "",
    item.pubDate ?? "",
    item.contentSnippet ?? "",
    item.content ?? "",
  ].join("|");

  return stableSeed ? hashString(stableSeed) : "(missing-guid)";
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
  const guid = resolveGuid(item);
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
    savedAt: null,
    readAt: null,
    starred: false,
    tags: null,
    searchVector: null,
  };
}

// DNS-resolving SSRF guard, shared with feed discovery and feed creation
// (see resolvePublicFeedUrl in server/utils/urlValidator.ts for the exact
// guarantee and its known TOCTOU limitation). This runs immediately before
// parser.parseURL on every sync — not just when the feed was first added —
// so a hostname that DNS-rebinds to a private address after add time is
// caught on the next scheduled sync rather than being fetched indefinitely.
export async function assertSafeFeedUrl(url: string): Promise<void> {
  await resolvePublicFeedUrl(url);
}

export async function parseRssFeed(
  url: string,
  feedId: number,
): Promise<NewFeedItem[]> {
  await assertSafeFeedUrl(url);
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
