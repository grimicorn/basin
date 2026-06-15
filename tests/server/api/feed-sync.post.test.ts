import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();

vi.mock("@netlify/async-workloads", () => {
  function MockAsyncWorkloadsClient() {
    return { send: mockSend };
  }
  return { AsyncWorkloadsClient: MockAsyncWorkloadsClient };
});

const mockFindMany = vi.fn();
vi.stubGlobal("useDb", () => ({
  query: { feeds: { findMany: mockFindMany } },
}));

import handler from "../../../server/api/feed-sync.post";

const mockUser = { id: 1 };
const mockFeeds = [
  { id: 10, userId: 1, source: "rss" },
  { id: 11, userId: 1, source: "rss" },
];

describe("POST /api/feed-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ sendStatus: "succeeded" });
    mockFindMany.mockResolvedValue(mockFeeds);
  });

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns queued: 0 when user has no feeds", async () => {
    mockFindMany.mockResolvedValue([]);
    const event = { context: { user: mockUser } };
    const result = await handler(event);
    expect(result).toEqual({ queued: 0 });
  });

  it("returns the count of successfully enqueued feeds", async () => {
    const event = { context: { user: mockUser } };
    const result = await handler(event);
    expect(result).toEqual({ queued: 2 });
  });

  it("only counts successful sends in the queued response", async () => {
    mockSend
      .mockResolvedValueOnce({ sendStatus: "succeeded" })
      .mockResolvedValueOnce({ sendStatus: "failed" });

    const event = { context: { user: mockUser } };
    const result = await handler(event);
    expect(result).toEqual({ queued: 1 });
  });

  it("logs an error when a send fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSend.mockResolvedValue({ sendStatus: "failed" });

    const event = { context: { user: mockUser } };
    await handler(event);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedValue = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(loggedValue.event).toBe("on_demand_emit_failed");
  });
});
