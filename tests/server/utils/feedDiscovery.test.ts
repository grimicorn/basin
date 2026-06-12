import { describe, it, expect, vi } from "vitest";
import { discoverFeedUrl } from "../../../server/utils/feedDiscovery";

function makeFetchFn(
  responses: Record<
    string,
    { ok: boolean; contentType?: string; body?: string }
  >,
) {
  return vi.fn(async (url: string) => {
    const entry = responses[url];
    if (!entry)
      return { ok: false, headers: { get: () => null }, text: async () => "" };
    return {
      ok: entry.ok,
      headers: {
        get: (name: string) =>
          name === "content-type" ? (entry.contentType ?? null) : null,
      },
      text: async () => entry.body ?? "",
    };
  });
}

const RSS_BODY = `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>`;
const ATOM_BODY = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>`;
const HTML_WITH_RSS_LINK = `<html><head>
  <link rel="alternate" type="application/rss+xml" href="https://example.com/feed.xml" />
</head><body></body></html>`;
const HTML_WITH_ATOM_LINK = `<html><head>
  <link rel="alternate" type="application/atom+xml" href="/atom.xml" />
</head><body></body></html>`;
const HTML_WITH_HREF_FIRST = `<html><head>
  <link href="https://example.com/rss.xml" rel="alternate" type="application/rss+xml" />
</head><body></body></html>`;
const HTML_NO_FEED_LINK = `<html><head><title>No feed</title></head><body></body></html>`;

describe("discoverFeedUrl", () => {
  describe("pass-through: URL is already a valid feed", () => {
    it("returns the URL as-is when the content-type is application/rss+xml", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com/feed.xml": {
          ok: true,
          contentType: "application/rss+xml; charset=utf-8",
          body: RSS_BODY,
        },
      });
      const result = await discoverFeedUrl(
        "https://example.com/feed.xml",
        fetchFn,
      );
      expect(result).toBe("https://example.com/feed.xml");
    });

    it("returns the URL as-is when the content-type is application/atom+xml", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com/atom.xml": {
          ok: true,
          contentType: "application/atom+xml",
          body: ATOM_BODY,
        },
      });
      const result = await discoverFeedUrl(
        "https://example.com/atom.xml",
        fetchFn,
      );
      expect(result).toBe("https://example.com/atom.xml");
    });

    it("returns the URL as-is when the body starts with an XML declaration and contains <rss>", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com/feed": {
          ok: true,
          contentType: "text/plain",
          body: RSS_BODY,
        },
      });
      const result = await discoverFeedUrl("https://example.com/feed", fetchFn);
      expect(result).toBe("https://example.com/feed");
    });

    it("returns the URL as-is when the body contains an Atom feed element", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com/feed": {
          ok: true,
          contentType: "text/plain",
          body: ATOM_BODY,
        },
      });
      const result = await discoverFeedUrl("https://example.com/feed", fetchFn);
      expect(result).toBe("https://example.com/feed");
    });
  });

  describe("link-tag discovery in HTML", () => {
    it("finds a feed URL from an RSS link tag (type before href)", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com": {
          ok: true,
          contentType: "text/html",
          body: HTML_WITH_RSS_LINK,
        },
      });
      const result = await discoverFeedUrl("https://example.com", fetchFn);
      expect(result).toBe("https://example.com/feed.xml");
    });

    it("finds a feed URL from an Atom link tag with a relative href", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com": {
          ok: true,
          contentType: "text/html",
          body: HTML_WITH_ATOM_LINK,
        },
      });
      const result = await discoverFeedUrl("https://example.com", fetchFn);
      expect(result).toBe("https://example.com/atom.xml");
    });

    it("finds a feed URL when href attribute comes before type attribute", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com": {
          ok: true,
          contentType: "text/html",
          body: HTML_WITH_HREF_FIRST,
        },
      });
      const result = await discoverFeedUrl("https://example.com", fetchFn);
      expect(result).toBe("https://example.com/rss.xml");
    });
  });

  describe("common path fallback", () => {
    it("returns a common path URL when its content-type is application/rss+xml", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com": {
          ok: true,
          contentType: "text/html",
          body: HTML_NO_FEED_LINK,
        },
        "https://example.com/feed": {
          ok: true,
          contentType: "application/rss+xml",
          body: RSS_BODY,
        },
      });
      const result = await discoverFeedUrl("https://example.com", fetchFn);
      expect(result).toBe("https://example.com/feed");
    });

    it("returns a common path URL when its body looks like an XML feed", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com": {
          ok: true,
          contentType: "text/html",
          body: HTML_NO_FEED_LINK,
        },
        "https://example.com/feed": { ok: false, contentType: "", body: "" },
        "https://example.com/feed.xml": {
          ok: true,
          contentType: "text/plain",
          body: RSS_BODY,
        },
      });
      const result = await discoverFeedUrl("https://example.com", fetchFn);
      expect(result).toBe("https://example.com/feed.xml");
    });

    it("tries /rss when /feed and /feed.xml are not available", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com": {
          ok: true,
          contentType: "text/html",
          body: HTML_NO_FEED_LINK,
        },
        "https://example.com/feed": { ok: false, body: "" },
        "https://example.com/feed.xml": { ok: false, body: "" },
        "https://example.com/rss": {
          ok: true,
          contentType: "application/rss+xml",
          body: RSS_BODY,
        },
      });
      const result = await discoverFeedUrl("https://example.com", fetchFn);
      expect(result).toBe("https://example.com/rss");
    });
  });

  describe("null when no feed is found", () => {
    it("returns null when the initial fetch fails", async () => {
      const fetchFn = makeFetchFn({});
      const result = await discoverFeedUrl("https://example.com", fetchFn);
      expect(result).toBeNull();
    });

    it("returns null when the page has no feed link and all common paths fail", async () => {
      const fetchFn = makeFetchFn({
        "https://example.com": {
          ok: true,
          contentType: "text/html",
          body: HTML_NO_FEED_LINK,
        },
      });
      const result = await discoverFeedUrl("https://example.com", fetchFn);
      expect(result).toBeNull();
    });
  });
});
