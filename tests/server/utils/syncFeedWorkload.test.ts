import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/utils/rssAdapter", () => ({
  fetchRssItemsForFeed: vi.fn(),
}));

import {
  syncFeed,
  type SyncFeedPayload,
} from "../../../server/utils/syncFeedWorkload";
import { fetchRssItemsForFeed } from "../../../server/utils/rssAdapter";

const mockFetchRssItems = vi.mocked(fetchRssItemsForFeed);

const rssFeedRow = {
  id: 7,
  userId: 1,
  url: "https://example.com/feed.xml",
  source: "rss",
  lastSyncedAt: null,
  lastFetched: null,
  title: "Test Feed",
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeRssItems = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    feedId: 7,
    guid: `guid-${index}`,
    title: `Article ${index}`,
    url: `https://example.com/${index}`,
    author: "Author",
    imageUrl: null,
    content: "content",
    publishedAt: new Date(),
    savedAt: new Date(),
  }));

type MakeDbOptions = {
  feed?: typeof rssFeedRow | null;
  returningIds?: { id: number }[];
};

function makeDb(overrides: MakeDbOptions = {}) {
  const feed = "feed" in overrides ? overrides.feed : rssFeedRow;
  const returningIds = overrides.returningIds ?? [{ id: 1 }, { id: 2 }];

  const mockReturning = vi.fn().mockResolvedValue(returningIds);
  const mockOnConflictDoNothing = vi
    .fn()
    .mockReturnValue({ returning: mockReturning });
  const mockValues = vi
    .fn()
    .mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  const mockSet = vi.fn();
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  mockSet.mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  const findFirst = vi.fn().mockResolvedValue(feed);

  return {
    db: {
      query: { feeds: { findFirst } },
      insert: mockInsert,
      update: mockUpdate,
    } as unknown as Parameters<typeof syncFeed>[0],
    findFirst,
    mockInsert,
    mockValues,
    mockOnConflictDoNothing,
    mockReturning,
    mockUpdate,
    mockSet,
    mockWhere,
  };
}

const basePayload: SyncFeedPayload = {
  userId: 1,
  feedId: 7,
  sourceType: "rss",
  mode: "scheduled",
};

describe("syncFeed", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns skipped when feed is not found", async () => {
    const { db } = makeDb({ feed: null });

    const result = await syncFeed(db, basePayload);

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("not found");
  });

  it("returns skipped when feed was synced within debounce window", async () => {
    const recentlySynced = { ...rssFeedRow, lastSyncedAt: new Date() };
    const { db } = makeDb({ feed: recentlySynced });

    const result = await syncFeed(db, basePayload);

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("debounced");
  });

  it("syncs RSS feed and returns upserted count", async () => {
    const { db, mockInsert } = makeDb({
      returningIds: [{ id: 10 }, { id: 11 }],
    });
    mockFetchRssItems.mockResolvedValue({
      items: makeRssItems(2),
      feedTitle: "Test Blog",
    });

    const result = await syncFeed(db, basePayload);

    expect(result.skipped).toBe(false);
    expect(result.upsertedCount).toBe(2);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("uses onConflictDoNothing for idempotent upsert", async () => {
    const { db, mockOnConflictDoNothing } = makeDb({});
    mockFetchRssItems.mockResolvedValue({
      items: makeRssItems(1),
      feedTitle: "Feed",
    });

    await syncFeed(db, basePayload);

    expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("updates lastSyncedAt after a successful sync", async () => {
    const { db, mockSet } = makeDb({});
    mockFetchRssItems.mockResolvedValue({
      items: makeRssItems(1),
      feedTitle: "Feed",
    });

    await syncFeed(db, basePayload);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastSyncedAt: expect.any(Date) }),
    );
  });

  it("skips insert when there are no items to upsert", async () => {
    const { db, mockInsert } = makeDb({});
    mockFetchRssItems.mockResolvedValue({ items: [], feedTitle: "Empty Feed" });

    const result = await syncFeed(db, basePayload);

    expect(result.skipped).toBe(false);
    expect(result.upsertedCount).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns skipped for unknown sourceType", async () => {
    const { db } = makeDb({});

    const result = await syncFeed(db, {
      ...basePayload,
      sourceType: "youtube",
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("no handler");
  });

  it("syncs podcast feeds using the RSS adapter", async () => {
    const { db } = makeDb({
      feed: { ...rssFeedRow, source: "podcast" },
      returningIds: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    mockFetchRssItems.mockResolvedValue({
      items: makeRssItems(3),
      feedTitle: "Podcast Feed",
    });

    const result = await syncFeed(db, {
      ...basePayload,
      sourceType: "podcast",
    });

    expect(result.skipped).toBe(false);
    expect(result.upsertedCount).toBe(3);
  });

  it("propagates errors from the RSS adapter", async () => {
    const { db } = makeDb({});
    mockFetchRssItems.mockRejectedValue(new Error("Feed fetch failed"));

    await expect(syncFeed(db, basePayload)).rejects.toThrow(
      "Feed fetch failed",
    );
  });
});
