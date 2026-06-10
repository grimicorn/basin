import { algoliasearch } from "algoliasearch";

export type AlgoliaFeedItem = {
  objectID: string;
  userId: number;
  feedId: number;
  guid: string;
  title: string;
  url: string | null;
  content: string | null;
  tags: string[] | null;
  publishedAt: string | null;
};

export type AlgoliaSearchResult = {
  objectID: string;
  guid: string;
  title: string;
  url: string | null;
  content: string | null;
  tags: string[] | null;
  publishedAt: string | null;
};

export type SearchHit = {
  objectID: string;
  guid: string;
  title: string;
  url: string | null;
  content: string | null;
  tags: string[] | null;
  publishedAt: string | null;
  [key: string]: unknown;
};

function getAlgoliaClient() {
  const config = useRuntimeConfig();
  return algoliasearch(config.algoliaAppId, config.algoliaAdminApiKey);
}

function getIndexName(): string {
  const config = useRuntimeConfig();
  return config.algoliaIndexName || "feed_items";
}

export async function saveItems(items: AlgoliaFeedItem[]): Promise<void> {
  const client = getAlgoliaClient();
  await client.saveObjects({
    indexName: getIndexName(),
    objects: items,
  });
}

export async function deleteItemsByUserId(userId: number): Promise<void> {
  const client = getAlgoliaClient();
  await client.deleteBy({
    indexName: getIndexName(),
    deleteByParams: {
      filters: `userId:${userId}`,
    },
  });
}

export async function searchFeedItems(
  query: string,
  userId: number,
): Promise<SearchHit[]> {
  const client = getAlgoliaClient();
  const results = await client.searchSingleIndex({
    indexName: getIndexName(),
    searchParams: {
      query,
      filters: `userId:${userId}`,
      hitsPerPage: 20,
    },
  });
  return results.hits as SearchHit[];
}
