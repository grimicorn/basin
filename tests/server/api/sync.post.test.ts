import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

  afterEach(() => {
    vi.useRealTimers();
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

  it("throws 400 when guid is missing", async () => {
    const event = makeEvent({ id: 1 }, "markRead", { feedId: 1 });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when guid is an empty string", async () => {
    const event = makeEvent({ id: 1 }, "markRead", { feedId: 1, guid: "" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when guid is not a string", async () => {
    const event = makeEvent({ id: 1 }, "markRead", { feedId: 1, guid: 42 });
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

  it("defaults readAt to now when absent", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-01-02T03:04:05.000Z");
    vi.setSystemTime(now);
    const event = makeEvent({ id: 1 }, "markRead", {
      feedId: 1,
      guid: "item-1",
    });
    await handler(event);
    expect(mockSet).toHaveBeenCalledWith({ readAt: now });
  });

  it("defaults readAt to now when explicitly null", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-01-02T03:04:05.000Z");
    vi.setSystemTime(now);
    const event = makeEvent({ id: 1 }, "markRead", {
      feedId: 1,
      guid: "item-1",
      readAt: null,
    });
    await handler(event);
    expect(mockSet).toHaveBeenCalledWith({ readAt: now });
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

  it("applies star with starred false and returns ok", async () => {
    const event = makeEvent({ id: 1 }, "star", {
      feedId: 1,
      guid: "item-1",
      starred: false,
    });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
    expect(mockSet).toHaveBeenCalledWith({ starred: false });
  });

  it("throws 400 when starred is not a boolean", async () => {
    const event = makeEvent({ id: 1 }, "star", {
      feedId: 1,
      guid: "item-1",
      starred: "true",
    });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throws 400 when starred is missing", async () => {
    const event = makeEvent({ id: 1 }, "star", { feedId: 1, guid: "item-1" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
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

  it("applies save with no savedAt and persists null", async () => {
    const event = makeEvent({ id: 1 }, "save", { feedId: 1, guid: "item-1" });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
    expect(mockSet).toHaveBeenCalledWith({ savedAt: null });
  });

  it("applies save with explicit null savedAt and persists null", async () => {
    const event = makeEvent({ id: 1 }, "save", {
      feedId: 1,
      guid: "item-1",
      savedAt: null,
    });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
    expect(mockSet).toHaveBeenCalledWith({ savedAt: null });
  });

  it("throws 400 when savedAt is a malformed date string", async () => {
    const event = makeEvent({ id: 1 }, "save", {
      feedId: 1,
      guid: "item-1",
      savedAt: "not-a-date",
    });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("persists a valid savedAt date", async () => {
    const iso = "2026-01-02T03:04:05.000Z";
    const event = makeEvent({ id: 1 }, "save", {
      feedId: 1,
      guid: "item-1",
      savedAt: iso,
    });
    await handler(event);
    expect(mockSet).toHaveBeenCalledWith({ savedAt: new Date(iso) });
  });

  it("throws 400 when savedAt is an empty string", async () => {
    const event = makeEvent({ id: 1 }, "save", {
      feedId: 1,
      guid: "item-1",
      savedAt: "",
    });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throws 400 when savedAt is a number", async () => {
    const event = makeEvent({ id: 1 }, "save", {
      feedId: 1,
      guid: "item-1",
      savedAt: 1767322800,
    });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throws 400 when readAt is a malformed date string", async () => {
    const event = makeEvent({ id: 1 }, "markRead", {
      feedId: 1,
      guid: "item-1",
      readAt: "not-a-date",
    });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("persists a valid readAt date", async () => {
    const iso = "2026-01-02T03:04:05.000Z";
    const event = makeEvent({ id: 1 }, "markRead", {
      feedId: 1,
      guid: "item-1",
      readAt: iso,
    });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
    expect(mockSet).toHaveBeenCalledWith({ readAt: new Date(iso) });
  });

  it("scopes the update where clause to both feedId and guid", async () => {
    const event = makeEvent({ id: 1 }, "markRead", {
      feedId: 2,
      guid: "item-42",
    });
    await handler(event);
    expect(mockWhere).toHaveBeenCalledTimes(1);
    const whereArg = mockWhere.mock.calls[0][0];
    // Drizzle SQL objects contain circular references, so we collect
    // primitive leaf values by walking queryChunks recursively.
    function collectLeaves(
      node: unknown,
      seen = new Set<unknown>(),
    ): unknown[] {
      if (node === null || node === undefined) {
        return [];
      }
      if (typeof node !== "object") {
        return [node];
      }
      if (seen.has(node)) {
        return [];
      }
      seen.add(node);
      if (Array.isArray(node)) {
        return node.flatMap((item) => collectLeaves(item, seen));
      }
      const obj = node as Record<string, unknown>;
      if (obj.queryChunks !== undefined) {
        return collectLeaves(obj.queryChunks, seen);
      }
      if (obj.value !== undefined) {
        return collectLeaves(obj.value, seen);
      }
      if (obj.name !== undefined) {
        return [obj.name];
      }
      return [];
    }
    const leaves = collectLeaves(whereArg);
    expect(leaves).toContain("feed_id");
    expect(leaves).toContain("guid");
    expect(leaves).toContain(2);
    expect(leaves).toContain("item-42");
  });
});
