import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockFindFirst = vi.fn();

vi.stubGlobal("useDb", () => ({
  update: mockUpdate,
  query: {
    feeds: { findFirst: mockFindFirst },
  },
}));

import handler from "../../../server/api/sync.post";

function makeEvent(
  user: Record<string, unknown> | null,
  action: string,
  payload: Record<string, unknown>,
) {
  return {
    context: { user },
    body: { action, payload },
  };
}

describe("POST /api/sync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue(undefined);
    // Default: user owns the feed
    mockFindFirst.mockResolvedValue({ id: 1 });
  });

  it("throws 401 when unauthenticated", async () => {
    const event = makeEvent(null, "markRead", { feedId: 1, guid: "abc" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 for an unknown action", async () => {
    const event = makeEvent({ id: 1 }, "destroy", { feedId: 1, guid: "abc" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when feedId is missing", async () => {
    const event = makeEvent({ id: 1 }, "markRead", { guid: "abc" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when feedId is not an integer", async () => {
    const event = makeEvent({ id: 1 }, "markRead", {
      feedId: 1.5,
      guid: "abc",
    });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when feedId is zero", async () => {
    const event = makeEvent({ id: 1 }, "markRead", { feedId: 0, guid: "abc" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 403 when the user does not own the feed", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const event = makeEvent({ id: 1 }, "markRead", { feedId: 99, guid: "abc" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not update when ownership check fails", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const event = makeEvent({ id: 1 }, "markRead", { feedId: 99, guid: "abc" });
    await expect(handler(event)).rejects.toBeDefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("applies markRead and returns ok", async () => {
    const event = makeEvent({ id: 1 }, "markRead", {
      feedId: 1,
      guid: "item-1",
    });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("applies star and returns ok", async () => {
    const event = makeEvent({ id: 1 }, "star", {
      feedId: 1,
      guid: "item-1",
      starred: true,
    });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("applies save and returns ok", async () => {
    const event = makeEvent({ id: 1 }, "save", {
      feedId: 1,
      guid: "item-1",
      savedAt: new Date().toISOString(),
    });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("scopes the update where clause to both feedId and guid", async () => {
    const event = makeEvent({ id: 1 }, "markRead", {
      feedId: 2,
      guid: "item-42",
    });
    await handler(event);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });
});
