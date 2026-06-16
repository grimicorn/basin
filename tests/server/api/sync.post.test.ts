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
