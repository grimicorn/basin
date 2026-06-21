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
    savedAt: new Date(),
    readAt: null,
    starred: false,
    tags: null,
    searchVector: null,
  };
}

const PRIVATE_IP_RANGES = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  // Link-local — used by AWS/GCP cloud metadata services
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
];

// URL.hostname wraps IPv6 addresses in brackets, so include both forms.
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Matches IPv4-mapped IPv6 addresses (e.g. [::ffff:127.0.0.1] or [::ffff:7f00:1]).
// URL.hostname preserves brackets for IPv6, so we match the bracketed form.
const IPV4_MAPPED_IPV6 = /^\[::ffff:/i;

export function validateFeedUrl(url: string): void {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid feed URL: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Feed URL must use http or https protocol, got: ${parsed.protocol}`,
    );
  }

  const hostname = parsed.hostname;

  if (LOOPBACK_HOSTNAMES.has(hostname)) {
    throw new Error(`Feed URL hostname is not allowed: ${hostname}`);
  }

  if (hostname === "0.0.0.0") {
    throw new Error(`Feed URL hostname is not allowed: ${hostname}`);
  }

  if (IPV4_MAPPED_IPV6.test(hostname)) {
    throw new Error(`Feed URL hostname is not allowed: ${hostname}`);
  }

  for (const range of PRIVATE_IP_RANGES) {
    if (range.test(hostname)) {
      throw new Error(`Feed URL hostname is not allowed: ${hostname}`);
    }
  }
}

export async function parseRssFeed(
  url: string,
  feedId: number,
): Promise<NewFeedItem[]> {
  validateFeedUrl(url);
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
