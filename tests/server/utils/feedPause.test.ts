import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

// select().from().where().orderBy() resolves to the user's feed rows.
const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

// update().set().where() is awaited directly on the pause path; the reactivate
// path additionally calls .returning() to count the rows it cleared.
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

vi.stubGlobal("useDb", () => ({
  select: mockSelect,
  update: mockUpdate,
}));

import {
  pauseFeedsOverFreeLimit,
  reactivateAllFeeds,
} from "../../../server/utils/feedPause";
import { FREE_PLAN_FEED_LIMIT } from "../../../server/utils/planLimits";

const dialect = new PgDialect();

// Simulates the DB returning feeds already ordered oldest-first (created_at
// asc, id asc), so ids double as position markers: id N is the Nth-oldest feed.
function feedsInDb(count: number, pausedIds: number[] = []) {
  const rows = Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return { id, paused: pausedIds.includes(id) };
  });
  mockOrderBy.mockResolvedValue(rows);
}

const USER_ID = 42;

describe("pauseFeedsOverFreeLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feedsInDb(0);
  });

  it("orders candidates oldest-first by created_at then id", async () => {
    feedsInDb(FREE_PLAN_FEED_LIMIT + 1);
    await pauseFeedsOverFreeLimit(USER_ID);

    const orderByArgs = mockOrderBy.mock.calls[0];
    // NULLS FIRST keeps anomalous null-created_at rows oldest (active), not paused.
    expect(dialect.sqlToQuery(orderByArgs[0]).sql).toContain(
      '"feeds"."created_at" asc nulls first',
    );
    expect(dialect.sqlToQuery(orderByArgs[1]).sql).toContain(
      '"feeds"."id" asc',
    );
  });

  it("leaves an account within the cap untouched", async () => {
    feedsInDb(FREE_PLAN_FEED_LIMIT);
    const result = await pauseFeedsOverFreeLimit(USER_ID);

    expect(result).toEqual({ pausedCount: 0 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("pauses only the sources beyond the cap, keeping the oldest N active", async () => {
    feedsInDb(FREE_PLAN_FEED_LIMIT + 2);
    const result = await pauseFeedsOverFreeLimit(USER_ID);

    expect(result).toEqual({ pausedCount: 2 });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ paused: true }),
    );

    // The two newest feeds (ids 11 and 12) are paused; the oldest ten survive.
    const { params } = dialect.sqlToQuery(mockUpdateWhere.mock.calls[0][0]);
    expect(params).toContain(FREE_PLAN_FEED_LIMIT + 1);
    expect(params).toContain(FREE_PLAN_FEED_LIMIT + 2);
    expect(params).not.toContain(1);
  });

  it("is idempotent: over-cap sources already paused are not rewritten", async () => {
    const overCapIds = [FREE_PLAN_FEED_LIMIT + 1, FREE_PLAN_FEED_LIMIT + 2];
    feedsInDb(FREE_PLAN_FEED_LIMIT + 2, overCapIds);
    const result = await pauseFeedsOverFreeLimit(USER_ID);

    expect(result).toEqual({ pausedCount: 0 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("pauses only the still-active over-cap sources on a partial re-run", async () => {
    // Feed 11 was paused by a prior run; feed 12 was added since and is active.
    feedsInDb(FREE_PLAN_FEED_LIMIT + 2, [FREE_PLAN_FEED_LIMIT + 1]);
    const result = await pauseFeedsOverFreeLimit(USER_ID);

    expect(result).toEqual({ pausedCount: 1 });
    const { params } = dialect.sqlToQuery(mockUpdateWhere.mock.calls[0][0]);
    expect(params).toContain(FREE_PLAN_FEED_LIMIT + 2);
    expect(params).not.toContain(FREE_PLAN_FEED_LIMIT + 1);
  });
});

describe("reactivateAllFeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateReturning.mockResolvedValue([]);
  });

  it("clears the paused flag on every paused source and counts them", async () => {
    mockUpdateReturning.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    const result = await reactivateAllFeeds(USER_ID);

    expect(result).toEqual({ reactivatedCount: 2 });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ paused: false }),
    );
  });

  it("is a no-op when nothing is paused", async () => {
    mockUpdateReturning.mockResolvedValue([]);
    const result = await reactivateAllFeeds(USER_ID);

    expect(result).toEqual({ reactivatedCount: 0 });
  });
});
