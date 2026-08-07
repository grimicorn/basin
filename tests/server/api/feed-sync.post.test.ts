import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend, mockFindMany } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock("@netlify/async-workloads", () => {
  class AsyncWorkloadsClient {
    send = mockSend;
  }
  return { AsyncWorkloadsClient };
});

vi.stubGlobal("useDb", () => ({
  query: {
    feeds: { findMany: mockFindMany },
  },
}));

import handler from "../../../server/api/feed-sync.post";

function makeEvent(user: Record<string, unknown> | null) {
  return { context: { user } };
}

const RSS_FEED = { id: 1, source: "rss" };
const PODCAST_FEED = { id: 2, source: "podcast" };

describe("POST /api/feed-sync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSend.mockResolvedValue({ sendStatus: "succeeded", eventId: "evt-123" });
  });

  it("throws 401 when unauthenticated", async () => {
    await expect(handler(makeEvent(null))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("returns queued:0 when the user has no syncable feeds", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await handler(makeEvent({ id: 1 }));
    expect(result).toEqual({ queued: 0, failed: 0, eventIds: [] });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("emits one event per syncable feed", async () => {
    mockFindMany.mockResolvedValue([RSS_FEED, PODCAST_FEED]);

    const result = await handler(makeEvent({ id: 5 }));
    expect(result.queued).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.eventIds).toHaveLength(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("sends events with mode on-demand and elevated priority", async () => {
    mockFindMany.mockResolvedValue([RSS_FEED]);

    await handler(makeEvent({ id: 5 }));

    expect(mockSend).toHaveBeenCalledWith("sync-feed", {
      data: { userId: 5, feedId: 1, sourceType: "rss", mode: "on-demand" },
      priority: 25,
    });
  });

  it("counts a failed sendStatus without throwing", async () => {
    mockFindMany.mockResolvedValue([RSS_FEED]);
    mockSend.mockResolvedValue({ sendStatus: "failed", eventId: "" });

    const result = await handler(makeEvent({ id: 5 }));
    expect(result).toEqual({ queued: 0, failed: 1, eventIds: [] });
  });

  it("continues emitting remaining feeds after one feed's emit fails", async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, source: "rss" },
      { id: 2, source: "podcast" },
      { id: 3, source: "youtube" },
    ]);
    mockSend
      .mockResolvedValueOnce({ sendStatus: "succeeded", eventId: "evt-1" })
      .mockRejectedValueOnce(new Error("emit boom"))
      .mockResolvedValueOnce({ sendStatus: "succeeded", eventId: "evt-3" });

    const result = await handler(makeEvent({ id: 5 }));

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(result.queued).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.eventIds).toEqual(["evt-1", "evt-3"]);
  });

  it("returns the eventIds from the client", async () => {
    mockFindMany.mockResolvedValue([RSS_FEED]);
    mockSend.mockResolvedValue({ sendStatus: "succeeded", eventId: "abc-xyz" });

    const result = await handler(makeEvent({ id: 5 }));
    expect(result.eventIds).toContain("abc-xyz");
  });
});
