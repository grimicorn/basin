import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

vi.stubGlobal("useDb", () => ({ insert: mockInsert }));

import handler from "../../../server/api/feeds.post";

const mockFeed = {
  id: 1,
  url: "https://example.com/feed.xml",
  source: "rss",
  userId: 1,
};

describe("POST /api/feeds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
  });

  it("throws 401 when unauthenticated", async () => {
    const event = {
      context: { user: null },
      body: { url: "https://example.com/feed.xml" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when URL is missing", async () => {
    const event = { context: { user: { id: 1 } }, body: {} };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when URL is blank", async () => {
    const event = { context: { user: { id: 1 } }, body: { url: "   " } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("inserts the feed and returns it", async () => {
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    const result = await handler(event);
    expect(result).toEqual(mockFeed);
  });

  it("detects rss source for a plain feed URL", async () => {
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: "rss" }),
    );
  });

  it("detects podcast source from URL containing 'podcast'", async () => {
    const podFeed = { ...mockFeed, source: "podcast" };
    mockReturning.mockResolvedValue([podFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://podcast.example.com/rss" },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: "podcast" }),
    );
  });

  it("trims whitespace from the URL before inserting", async () => {
    mockReturning.mockResolvedValue([mockFeed]);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "  https://example.com/feed.xml  " },
    };
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/feed.xml" }),
    );
  });
});
