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
    expect(result).toEqual({ queued: 0, eventIds: [] });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("emits one event per syncable feed", async () => {
    mockFindMany.mockResolvedValue([RSS_FEED, PODCAST_FEED]);

    const result = await handler(makeEvent({ id: 5 }));
    expect(result.queued).toBe(2);
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

  it("throws when the client returns a failed sendStatus", async () => {
    mockFindMany.mockResolvedValue([RSS_FEED]);
    mockSend.mockResolvedValue({ sendStatus: "failed", eventId: "" });

    await expect(handler(makeEvent({ id: 5 }))).rejects.toThrow();
  });

  it("returns the eventIds from the client", async () => {
    mockFindMany.mockResolvedValue([RSS_FEED]);
    mockSend.mockResolvedValue({ sendStatus: "succeeded", eventId: "abc-xyz" });

    const result = await handler(makeEvent({ id: 5 }));
    expect(result.eventIds).toContain("abc-xyz");
  });
});
