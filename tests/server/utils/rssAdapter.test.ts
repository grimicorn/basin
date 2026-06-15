import { describe, it, expect, vi } from "vitest";
import {
  createRssAdapter,
  fetchRssItemsForFeed,
} from "../../../server/utils/rssAdapter";

const makeParsedFeed = (overrides: Record<string, unknown> = {}) => ({
  title: "Test Blog",
  items: [
    {
      title: "Article One",
      guid: "guid-001",
      link: "https://example.com/article-1",
      creator: "Alice",
      contentSnippet: "Short snippet",
      isoDate: "2024-01-15T10:00:00.000Z",
    },
    {
      title: "Article Two",
      guid: "guid-002",
      link: "https://example.com/article-2",
      contentSnippet: "Another snippet",
      pubDate: "Mon, 14 Jan 2024 08:00:00 GMT",
    },
  ],
  ...overrides,
});

describe("createRssAdapter", () => {
  it("maps items to RssFeedItem shape", async () => {
    const parseFn = vi.fn().mockResolvedValue(makeParsedFeed());
    const adapter = createRssAdapter(parseFn);

    const result = await adapter("https://example.com/feed.xml");

    expect(result.feedTitle).toBe("Test Blog");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      guid: "guid-001",
      title: "Article One",
      url: "https://example.com/article-1",
      author: "Alice",
      content: "Short snippet",
    });
    expect(result.items[0].publishedAt).toEqual(
      new Date("2024-01-15T10:00:00.000Z"),
    );
  });

  it("falls back to feed title when item has no creator", async () => {
    const parseFn = vi.fn().mockResolvedValue(makeParsedFeed());
    const adapter = createRssAdapter(parseFn);

    const result = await adapter("https://example.com/feed.xml");

    expect(result.items[1].author).toBe("Test Blog");
  });

  it("generates a guid from link hash when item has no guid", async () => {
    const parseFn = vi.fn().mockResolvedValue({
      title: "Feed",
      items: [
        {
          title: "No Guid Item",
          link: "https://example.com/no-guid",
          contentSnippet: "content",
        },
      ],
    });
    const adapter = createRssAdapter(parseFn);

    const result = await adapter("https://example.com/feed.xml");

    expect(result.items[0].guid).toMatch(/^[0-9a-f]{64}$/);
  });

  it("parses pubDate when isoDate is missing", async () => {
    const parseFn = vi.fn().mockResolvedValue({
      title: "Feed",
      items: [
        {
          title: "Item",
          guid: "g1",
          link: "https://example.com/1",
          pubDate: "Mon, 14 Jan 2024 08:00:00 GMT",
        },
      ],
    });
    const adapter = createRssAdapter(parseFn);

    const result = await adapter("https://example.com/feed.xml");

    expect(result.items[0].publishedAt).toBeInstanceOf(Date);
    expect(isNaN(result.items[0].publishedAt!.getTime())).toBe(false);
  });

  it("returns null publishedAt when no date is present", async () => {
    const parseFn = vi.fn().mockResolvedValue({
      title: "Feed",
      items: [{ title: "Item", guid: "g1", link: "https://example.com/1" }],
    });
    const adapter = createRssAdapter(parseFn);

    const result = await adapter("https://example.com/feed.xml");

    expect(result.items[0].publishedAt).toBeNull();
  });

  it("extracts image from media:thumbnail", async () => {
    const parseFn = vi.fn().mockResolvedValue({
      title: "Feed",
      items: [
        {
          title: "Item",
          guid: "g1",
          link: "https://example.com/1",
          "media:thumbnail": { $: { url: "https://example.com/thumb.jpg" } },
        },
      ],
    });
    const adapter = createRssAdapter(parseFn);

    const result = await adapter("https://example.com/feed.xml");

    expect(result.items[0].imageUrl).toBe("https://example.com/thumb.jpg");
  });

  it("caps items at MAX_ITEMS_PER_SYNC (50)", async () => {
    const manyItems = Array.from({ length: 100 }, (_, index) => ({
      title: `Item ${index}`,
      guid: `guid-${index}`,
      link: `https://example.com/${index}`,
    }));
    const parseFn = vi
      .fn()
      .mockResolvedValue({ title: "Feed", items: manyItems });
    const adapter = createRssAdapter(parseFn);

    const result = await adapter("https://example.com/feed.xml");

    expect(result.items.length).toBe(50);
  });

  it("propagates parser errors", async () => {
    const parseFn = vi.fn().mockRejectedValue(new Error("Network error"));
    const adapter = createRssAdapter(parseFn);

    await expect(adapter("https://example.com/feed.xml")).rejects.toThrow(
      "Network error",
    );
  });
});

describe("fetchRssItemsForFeed", () => {
  it("stamps feedId onto every item", async () => {
    const parseFn = vi.fn().mockResolvedValue(makeParsedFeed());

    const result = await fetchRssItemsForFeed(
      "https://example.com/feed.xml",
      42,
      parseFn,
    );

    expect(result.items.every((item) => item.feedId === 42)).toBe(true);
  });

  it("returns feedTitle from parsed feed", async () => {
    const parseFn = vi.fn().mockResolvedValue(makeParsedFeed());

    const result = await fetchRssItemsForFeed(
      "https://example.com/feed.xml",
      1,
      parseFn,
    );

    expect(result.feedTitle).toBe("Test Blog");
  });
});
