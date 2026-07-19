import { describe, it, expect } from "vitest";
import {
  parseOpml,
  serializeOpml,
  OpmlParseError,
  MAX_OPML_ENTRIES,
} from "../../../server/utils/opml";

const VALID_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>My Feeds</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="Example Feed" title="Example Feed" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com"/>
    </outline>
    <outline type="rss" text="Another Feed" xmlUrl="https://another.com/rss"/>
  </body>
</opml>`;

describe("parseOpml", () => {
  it("parses feed outlines including nested ones inside category outlines", () => {
    const { entries } = parseOpml(VALID_OPML);
    expect(entries).toEqual([
      {
        xmlUrl: "https://example.com/feed.xml",
        title: "Example Feed",
        htmlUrl: "https://example.com",
      },
      {
        xmlUrl: "https://another.com/rss",
        title: "Another Feed",
        htmlUrl: null,
      },
    ]);
  });

  it("skips outlines without an xmlUrl (folders/categories)", () => {
    const { entries } = parseOpml(VALID_OPML);
    expect(entries.some((entry) => entry.xmlUrl === undefined)).toBe(false);
    expect(entries).toHaveLength(2);
  });

  it("falls back to the text attribute when title is absent", () => {
    const xml = `<opml><body><outline text="Only Text" xmlUrl="https://example.com/a.xml"/></body></opml>`;
    const { entries } = parseOpml(xml);
    expect(entries[0].title).toBe("Only Text");
  });

  it("returns null title when neither title nor text is present", () => {
    const xml = `<opml><body><outline xmlUrl="https://example.com/a.xml"/></body></opml>`;
    const { entries } = parseOpml(xml);
    expect(entries[0].title).toBeNull();
  });

  it("unescapes XML entities in attribute values", () => {
    const xml = `<opml><body><outline title="Tom &amp; Jerry" xmlUrl="https://example.com/a.xml?x=1&amp;y=2"/></body></opml>`;
    const { entries } = parseOpml(xml);
    expect(entries[0].title).toBe("Tom & Jerry");
    expect(entries[0].xmlUrl).toBe("https://example.com/a.xml?x=1&y=2");
  });

  it("dedupes repeated xmlUrl entries, keeping the first occurrence", () => {
    const xml = `<opml><body>
      <outline title="First" xmlUrl="https://example.com/a.xml"/>
      <outline title="Second" xmlUrl="https://example.com/a.xml"/>
    </body></opml>`;
    const { entries } = parseOpml(xml);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("First");
  });

  it("caps results at MAX_OPML_ENTRIES and reports the truncated count", () => {
    const outlines = Array.from(
      { length: MAX_OPML_ENTRIES + 10 },
      (_, index) => `<outline xmlUrl="https://example.com/${index}.xml"/>`,
    ).join("\n");
    const xml = `<opml><body>${outlines}</body></opml>`;
    const { entries, truncatedCount } = parseOpml(xml);
    expect(entries).toHaveLength(MAX_OPML_ENTRIES);
    expect(truncatedCount).toBe(10);
  });

  it("reports truncatedCount 0 when under the cap", () => {
    const { truncatedCount } = parseOpml(VALID_OPML);
    expect(truncatedCount).toBe(0);
  });

  it("throws OpmlParseError for empty input", () => {
    expect(() => parseOpml("")).toThrow(OpmlParseError);
  });

  it("throws OpmlParseError for non-OPML XML", () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>Not OPML</title></channel></rss>`;
    expect(() => parseOpml(xml)).toThrow(OpmlParseError);
  });

  it("throws OpmlParseError for garbage input", () => {
    expect(() => parseOpml("this is not xml at all")).toThrow(OpmlParseError);
  });

  it("returns an empty list for a valid but feed-less OPML document", () => {
    const xml = `<opml><body><outline text="Empty Folder"/></body></opml>`;
    expect(parseOpml(xml).entries).toEqual([]);
  });

  it("does not throw on a malformed individual outline tag, it just skips it", () => {
    const xml = `<opml><body>
      <outline xmlUrl="https://example.com/good.xml" title="Good"/>
      <outline this is not valid attribute syntax>
    </body></opml>`;
    const { entries } = parseOpml(xml);
    expect(entries).toEqual([
      { xmlUrl: "https://example.com/good.xml", title: "Good", htmlUrl: null },
    ]);
  });
});

describe("serializeOpml", () => {
  it("produces a document parseOpml can read back", () => {
    const feeds = [
      { url: "https://example.com/feed.xml", title: "Example Feed" },
      { url: "https://another.com/rss", title: null },
    ];
    const xml = serializeOpml(feeds);
    const { entries } = parseOpml(xml);

    expect(entries).toEqual([
      {
        xmlUrl: "https://example.com/feed.xml",
        title: "Example Feed",
        htmlUrl: null,
      },
      {
        xmlUrl: "https://another.com/rss",
        title: "https://another.com/rss",
        htmlUrl: null,
      },
    ]);
  });

  it("escapes XML entities in titles and URLs", () => {
    const xml = serializeOpml([
      { url: "https://example.com/a.xml?x=1&y=2", title: "Tom & Jerry" },
    ]);
    expect(xml).toContain("Tom &amp; Jerry");
    expect(xml).toContain("https://example.com/a.xml?x=1&amp;y=2");
    expect(xml).not.toContain('Tom & Jerry"');
  });

  it("falls back to the URL as the title when title is null", () => {
    const xml = serializeOpml([
      { url: "https://example.com/feed.xml", title: null },
    ]);
    expect(xml).toContain('text="https://example.com/feed.xml"');
  });

  it("produces a valid opml root and body", () => {
    const xml = serializeOpml([]);
    expect(xml).toMatch(/<opml version="2.0">/);
    expect(xml).toContain("<body>");
    expect(xml).toContain("</body>");
    expect(xml).toContain("</opml>");
  });
});
