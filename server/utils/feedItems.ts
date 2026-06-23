import { desc, eq, and } from "drizzle-orm";
import { feedItems, feeds } from "../db/schema";
import { FEED_SOURCE_TO_ITEM_TYPE } from "../../app/utils/feedSources";
import { formatRelativeTime } from "./search";

export const FEED_ITEMS_DEFAULT_LIMIT = 50;
export const FEED_ITEMS_MAX_LIMIT = 200;

export interface FeedItemResult {
  id: number;
  feedId: number;
  guid: string;
  type: string;
  source: string;
  handle: string;
  time: string;
  title: string;
  url: string | null;
  author: string | null;
  imageUrl: string | null;
  content: string | null;
  tags: string[] | null;
  publishedAt: Date | null;
  readAt: Date | null;
  starred: boolean | null;
  savedAt: Date | null;
  mediaUrl: string | null;
  mediaDuration: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  unread: boolean;
  saved: boolean;
}

export interface FeedItemsPage {
  items: FeedItemResult[];
  total: number;
  nextOffset: number | null;
}

export interface FeedItemsQuery {
  limit?: number;
  offset?: number;
}

function clampLimit(raw: number | undefined): number {
  const resolved = raw ?? FEED_ITEMS_DEFAULT_LIMIT;
  return Math.min(Math.max(1, resolved), FEED_ITEMS_MAX_LIMIT);
}

function resolveOffset(raw: number | undefined): number {
  return Math.max(0, raw ?? 0);
}

function mapRow(row: {
  id: number;
  feedId: number;
  feedSource: string;
  feedTitle: string | null;
  guid: string;
  title: string;
  url: string | null;
  author: string | null;
  imageUrl: string | null;
  content: string | null;
  tags: string[] | null;
  publishedAt: Date | null;
  readAt: Date | null;
  starred: boolean | null;
  savedAt: Date | null;
  mediaUrl: string | null;
  mediaDuration: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): FeedItemResult {
  return {
    id: row.id,
    feedId: row.feedId,
    guid: row.guid,
    type: FEED_SOURCE_TO_ITEM_TYPE[row.feedSource] ?? row.feedSource,
    source: row.feedTitle?.trim() || row.feedSource,
    handle: row.feedTitle?.trim() || row.feedSource,
    time: formatRelativeTime(row.publishedAt),
    title: row.title,
    url: row.url,
    author: row.author,
    imageUrl: row.imageUrl,
    content: row.content,
    tags: row.tags,
    publishedAt: row.publishedAt,
    readAt: row.readAt,
    starred: row.starred,
    savedAt: row.savedAt,
    mediaUrl: row.mediaUrl,
    mediaDuration: row.mediaDuration,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    unread: row.readAt === null,
    saved: row.savedAt !== null,
  };
}

export async function fetchFeedItems(
  userId: number,
  query: FeedItemsQuery,
): Promise<FeedItemsPage> {
  const db = useDb();
  const limit = clampLimit(query.limit);
  const offset = resolveOffset(query.offset);

  const rows = await db
    .select({
      id: feedItems.id,
      feedId: feedItems.feedId,
      feedSource: feeds.source,
      feedTitle: feeds.title,
      guid: feedItems.guid,
      title: feedItems.title,
      url: feedItems.url,
      author: feedItems.author,
      imageUrl: feedItems.imageUrl,
      content: feedItems.content,
      tags: feedItems.tags,
      publishedAt: feedItems.publishedAt,
      readAt: feedItems.readAt,
      starred: feedItems.starred,
      savedAt: feedItems.savedAt,
      mediaUrl: feedItems.mediaUrl,
      mediaDuration: feedItems.mediaDuration,
      createdAt: feedItems.createdAt,
      updatedAt: feedItems.updatedAt,
    })
    .from(feedItems)
    .innerJoin(
      feeds,
      and(eq(feedItems.feedId, feeds.id), eq(feeds.userId, userId)),
    )
    .orderBy(desc(feedItems.publishedAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextOffset = hasMore ? offset + limit : null;

  return {
    items: pageRows.map(mapRow),
    total: pageRows.length,
    nextOffset,
  };
}
