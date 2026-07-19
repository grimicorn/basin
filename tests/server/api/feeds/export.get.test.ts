import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockSetHeader = vi.fn();

vi.stubGlobal("useDb", () => ({
  query: { feeds: { findMany: mockFindMany } },
}));
vi.stubGlobal("setHeader", mockSetHeader);

import handler from "../../../../server/api/feeds/export.get";
import { parseOpml } from "../../../../server/utils/opml";

const mockFeed = {
  id: 1,
  userId: 1,
  url: "https://example.com/feed.xml",
  title: "Example Feed",
  source: "rss",
  createdAt: null,
};

describe("GET /api/feeds/export", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockSetHeader.mockReset();
  });

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns an OPML document containing the user's feeds", async () => {
    mockFindMany.mockResolvedValue([mockFeed]);
    const event = { context: { user: { id: 1 } } };

    const opml = await handler(event);
    const parsed = parseOpml(opml);

    expect(parsed.entries).toEqual([
      {
        xmlUrl: "https://example.com/feed.xml",
        title: "Example Feed",
        htmlUrl: null,
      },
    ]);
  });

  it("returns a valid empty OPML document when the user has no feeds", async () => {
    mockFindMany.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };

    const opml = await handler(event);

    expect(parseOpml(opml).entries).toEqual([]);
  });

  it("sets the content-type and content-disposition headers for a file download", async () => {
    mockFindMany.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };

    await handler(event);

    expect(mockSetHeader).toHaveBeenCalledWith(
      event,
      "Content-Type",
      expect.stringContaining("opml"),
    );
    expect(mockSetHeader).toHaveBeenCalledWith(
      event,
      "Content-Disposition",
      expect.stringContaining("feeds.opml"),
    );
  });
});
