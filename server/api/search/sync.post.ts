import { eq, inArray } from "drizzle-orm";
import { feedItems, feeds } from "../../db/schema";
import { saveItems } from "../../utils/algolia";
import type { AlgoliaFeedItem } from "../../utils/algolia";

type FeedItemRow = typeof feedItems.$inferSelect;

function toAlgoliaItem(item: FeedItemRow, userId: number): AlgoliaFeedItem {
  return {
    objectID: `feed_item_${item.id}`,
    userId,
    feedId: item.feedId,
    guid: item.guid,
    title: item.title,
    url: item.url ?? null,
    content: item.content ?? null,
    tags: item.tags ?? null,
    publishedAt: item.publishedAt?.toISOString() ?? null,
  };
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const db = useDb();

  const userFeeds = await db.query.feeds.findMany({
    where: eq(feeds.userId, user.id),
  });

  if (userFeeds.length === 0) {
    return { synced: 0 };
  }

  const feedIds = userFeeds.map((feed) => feed.id);

  const items = await db.query.feedItems.findMany({
    where: inArray(feedItems.feedId, feedIds),
  });

  if (items.length === 0) {
    return { synced: 0 };
  }

  const algoliaItems = items.map((item) => toAlgoliaItem(item, user.id));

  await saveItems(algoliaItems);

  return { synced: algoliaItems.length };
});
