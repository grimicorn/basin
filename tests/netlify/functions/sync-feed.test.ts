import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindFirst,
  mockUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockInsert,
  mockInsertValues,
  mockInsertOnConflict,
  mockInsertReturning,
  mockParseRssFeed,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockInsert: vi.fn(),
  mockInsertValues: vi.fn(),
  mockInsertOnConflict: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockParseRssFeed: vi.fn(),
}));

vi.mock("../../../netlify/functions/db", () => ({
  createDb: vi.fn(() => ({
    query: { feeds: { findFirst: mockFindFirst } },
    update: mockUpdate,
    insert: mockInsert,
  })),
}));

vi.mock("../../../server/utils/rssAdapter", () => ({
  parseRssFeed: mockParseRssFeed,
}));

// Mock async-workloads — asyncWorkloadFn is an identity wrapper in tests
vi.mock("@netlify/async-workloads", () => ({
  asyncWorkloadFn: (fn: Function) => fn,
  ErrorDoNotRetry: class ErrorDoNotRetry extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ErrorDoNotRetry";
    }
  },
  ErrorRetryAfterDelay: class ErrorRetryAfterDelay extends Error {
    constructor(opts: { message: string }) {
      super(opts.message);
      this.name = "ErrorRetryAfterDelay";
    }
  },
}));

import handler from "../../../netlify/functions/sync-feed";

const RECENT_FETCH = new Date(Date.now() - 60_000); // 1 minute ago
const STALE_FETCH = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

function makeFeed(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    url: "https://example.com/feed.xml",
    source: "rss",
    lastFetched: null,
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventName: "sync-feed" as const,
    eventData: {
      userId: 1,
      feedId: 1,
      sourceType: "rss" as const,
      mode: "scheduled" as const,
    },
    eventId: "evt-1",
    attempt: 0,
    ...overrides,
  };
}

describe("sync-feed workload", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);

    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({
      onConflictDoNothing: mockInsertOnConflict,
    });
    mockInsertOnConflict.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([{ id: 10 }, { id: 11 }]);

    mockParseRssFeed.mockResolvedValue([
      {
        feedId: 1,
        guid: "urn:1",
        title: "Item 1",
        url: "https://example.com/1",
        author: "Alice",
        content: "Content",
        imageUrl: null,
        publishedAt: new Date(),
        savedAt: new Date(),
        readAt: null,
        starred: false,
        tags: null,
        searchVector: null,
      },
    ]);
  });

  it("syncs an RSS feed and marks it synced", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: STALE_FETCH }));

    await (handler as Function)(makeEvent());

    expect(mockParseRssFeed).toHaveBeenCalledWith(
      "https://example.com/feed.xml",
      1,
    );
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("no-ops when within debounce window in scheduled mode", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: RECENT_FETCH }));

    await (handler as Function)(
      makeEvent({
        eventData: {
          userId: 1,
          feedId: 1,
          sourceType: "rss",
          mode: "scheduled",
        },
      }),
    );

    expect(mockParseRssFeed).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does NOT debounce on-demand syncs even when recently fetched", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: RECENT_FETCH }));

    await (handler as Function)(
      makeEvent({
        eventData: {
          userId: 1,
          feedId: 1,
          sourceType: "rss",
          mode: "on-demand",
        },
      }),
    );

    expect(mockParseRssFeed).toHaveBeenCalledTimes(1);
  });

  it("throws ErrorDoNotRetry for an unsupported sourceType", async () => {
    await expect(
      (handler as Function)(
        makeEvent({
          eventData: {
            userId: 1,
            feedId: 1,
            sourceType: "twitter",
            mode: "scheduled",
          },
        }),
      ),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });
  });

  it("throws ErrorDoNotRetry when the feed is not found", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await expect((handler as Function)(makeEvent())).rejects.toMatchObject({
      name: "ErrorDoNotRetry",
    });
  });

  it("throws ErrorRetryAfterDelay when RSS fetch fails on early attempts", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockRejectedValue(new Error("Network timeout"));

    await expect(
      (handler as Function)(makeEvent({ attempt: 1 })),
    ).rejects.toMatchObject({ name: "ErrorRetryAfterDelay" });
  });

  it("throws ErrorDoNotRetry after max retries", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockRejectedValue(new Error("Persistent failure"));

    await expect(
      (handler as Function)(makeEvent({ attempt: 4 })),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });
  });

  it("does not call markFeedSynced when upsert fails", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockRejectedValue(new Error("Parse error"));

    await expect(
      (handler as Function)(makeEvent({ attempt: 0 })),
    ).rejects.toBeDefined();
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("skips insert when adapter returns no items", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockResolvedValue([]);

    await (handler as Function)(makeEvent());

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });
});
