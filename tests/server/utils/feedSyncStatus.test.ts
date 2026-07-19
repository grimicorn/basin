import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearFeedSyncFailures } from "../../../server/utils/feedSyncStatus";

function makeDb() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return {
    db: { update } as unknown as Parameters<typeof clearFeedSyncFailures>[0],
    update,
    set,
    where,
  };
}

describe("clearFeedSyncFailures", () => {
  beforeEach(() => vi.resetAllMocks());

  it("clears syncStatus, syncError, and syncFailedAt for the user's feeds of that source", async () => {
    const { db, set } = makeDb();

    await clearFeedSyncFailures(db, 1, "youtube");

    expect(set).toHaveBeenCalledWith({
      syncStatus: "ok",
      syncError: null,
      syncFailedAt: null,
    });
  });

  it("scopes the update to a single db.update() call", async () => {
    const { db, update } = makeDb();

    await clearFeedSyncFailures(db, 1, "bluesky");

    expect(update).toHaveBeenCalledTimes(1);
  });
});
