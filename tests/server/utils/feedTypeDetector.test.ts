import { describe, it, expect } from "vitest";
import { detectFeedSourceType } from "../../../server/utils/feedTypeDetector";

const rssHeader = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>`;
const rssFooter = `</channel></rss>`;

const atomHeader = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">`;
const atomFooter = `</feed>`;

const itunesHeader = `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>`;

function makeRssFeed(items: string[]): string {
  return `${rssHeader}${items.join("")}${rssFooter}`;
}

function makeAtomFeed(entries: string[]): string {
  return `${atomHeader}${entries.join("")}${atomFooter}`;
}

function makeItunesFeed(items: string[]): string {
  return `${itunesHeader}${items.join("")}${rssFooter}`;
}

describe("detectFeedSourceType", () => {
  describe("plain RSS feeds are classified as rss", () => {
    it("returns rss for a feed with no enclosures", () => {
      const feed = makeRssFeed([
        `<item><title>Post</title><link>https://example.com/1</link></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });

    it("returns rss for a feed with a non-audio image enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Post</title><enclosure url="https://example.com/img.jpg" type="image/jpeg" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });

    it("returns rss for a feed with a PDF enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Article</title><enclosure url="https://example.com/doc.pdf" type="application/pdf" length="99999"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });

    it("returns rss for an empty feed body", () => {
      const feed = makeRssFeed([]);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });

    it("returns rss for a plain Atom feed with no enclosures", () => {
      const feed = makeAtomFeed([
        `<entry><title>Post</title><link href="https://example.com/1"/></entry>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });
  });

  describe("audio enclosures classify the feed as podcast", () => {
    it("returns podcast when an item has an audio/mpeg enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Episode 1</title><enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="1234567"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast when an item has an audio/mp4 enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Episode 2</title><enclosure url="https://example.com/ep2.m4a" type="audio/mp4" length="1234567"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast when an item has a video/mp4 enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Episode 3</title><enclosure url="https://example.com/ep3.mp4" type="video/mp4" length="1234567"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast when the enclosure has a generic MIME type but an .mp3 extension", () => {
      const feed = makeRssFeed([
        `<item><title>Episode 4</title><enclosure url="https://example.com/ep4.mp3" type="application/octet-stream" length="1234567"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast when the enclosure has a generic MIME type but a .m4a extension", () => {
      const feed = makeRssFeed([
        `<item><title>Episode 5</title><enclosure url="https://example.com/ep5.m4a" type="application/octet-stream" length="1234567"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast when the enclosure has a generic MIME type but an .aac extension", () => {
      const feed = makeRssFeed([
        `<item><title>Episode 6</title><enclosure url="https://example.com/ep6.aac" type="application/octet-stream" length="1234567"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for an Atom feed with an audio enclosure link", () => {
      const feed = makeAtomFeed([
        `<entry><title>Episode 7</title><link rel="enclosure" href="https://example.com/ep7.mp3" type="audio/mpeg"/></entry>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for an Atom feed with a generic enclosure MIME type but .mp3 extension", () => {
      const feed = makeAtomFeed([
        `<entry><title>Episode 8</title><link rel="enclosure" href="https://example.com/ep8.mp3" type="application/octet-stream"/></entry>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });
  });

  describe("iTunes namespace signals a podcast", () => {
    it("returns podcast when feed has iTunes namespace and itunes:duration tags", () => {
      const feed = makeItunesFeed([
        `<item><title>Episode 9</title><itunes:duration>45:00</itunes:duration></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast when feed has iTunes namespace and itunes:episode tags", () => {
      const feed = makeItunesFeed([
        `<item><title>Episode 10</title><itunes:episode>10</itunes:episode></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns rss when iTunes namespace is declared but no episode-level tags are present", () => {
      const feed = makeItunesFeed([
        `<item><title>Post</title><link>https://example.com/post</link></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });
  });

  describe("only samples the first few items", () => {
    it("still detects podcast when the audio enclosure appears in the first item of many", () => {
      const items = [
        `<item><title>Episode 1</title><enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="1"/></item>`,
        ...Array.from(
          { length: 10 },
          (_, index) =>
            `<item><title>Post ${index + 2}</title><link>https://example.com/${index + 2}</link></item>`,
        ),
      ];
      const feed = makeRssFeed(items);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns rss when an audio enclosure only appears beyond the sample window", () => {
      const items = [
        ...Array.from(
          { length: 5 },
          (_, index) =>
            `<item><title>Post ${index + 1}</title><link>https://example.com/${index + 1}</link></item>`,
        ),
        `<item><title>Episode 6</title><enclosure url="https://example.com/ep6.mp3" type="audio/mpeg" length="1"/></item>`,
      ];
      const feed = makeRssFeed(items);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });
  });

  describe("extension fallback when type attribute is missing", () => {
    it("returns podcast for an enclosure with no type attribute but an .mp3 url", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.mp3" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for an Atom enclosure with no type attribute but an .mp3 href", () => {
      const feed = makeAtomFeed([
        `<entry><title>Episode</title><link rel="enclosure" href="https://example.com/ep.mp3"/></entry>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });
  });

  describe("multiple enclosures per item", () => {
    it("returns podcast when the first enclosure is non-audio but a later one is audio", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/cover.jpg" type="image/jpeg" length="1"/><enclosure url="https://example.com/ep.mp3" type="audio/mpeg" length="1234567"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for Atom when the first enclosure link is non-audio but a later one is audio", () => {
      const feed = makeAtomFeed([
        `<entry><title>Episode</title><link rel="enclosure" href="https://example.com/cover.jpg" type="image/jpeg"/><link rel="enclosure" href="https://example.com/ep.mp3" type="audio/mpeg"/></entry>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns rss when all enclosures in an item are non-audio", () => {
      const feed = makeRssFeed([
        `<item><title>Post</title><enclosure url="https://example.com/cover.jpg" type="image/jpeg" length="1"/><enclosure url="https://example.com/doc.pdf" type="application/pdf" length="99999"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });
  });

  describe("extension fallback matches URLs with query strings or fragments", () => {
    it("returns podcast for an .mp3 url with a query string", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.mp3?download=1" type="application/octet-stream" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for an .mp3 url with a hash fragment", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.mp3#part1" type="application/octet-stream" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for a missing-type enclosure with an .mp3 url with a query string", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.mp3?token=abc" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });
  });

  describe("additional audio/video file extensions", () => {
    it("returns podcast for an .ogg enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.ogg" type="application/octet-stream" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for an .opus enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.opus" type="application/octet-stream" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for a .flac enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.flac" type="application/octet-stream" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for a .wav enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.wav" type="application/octet-stream" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for a .m4v enclosure", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.m4v" type="application/octet-stream" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });
  });

  describe("MIME type case insensitivity", () => {
    it("returns podcast for uppercase AUDIO/MPEG MIME type", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.mp3" type="AUDIO/MPEG" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for mixed-case Audio/Mpeg MIME type", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.mp3" type="Audio/Mpeg" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for uppercase VIDEO/MP4 MIME type", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.mp4" type="VIDEO/MP4" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });
  });

  describe("audio/* MIME types beyond audio/mpeg and audio/mp4", () => {
    it("returns podcast for audio/ogg MIME type", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.ogg" type="audio/ogg" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for audio/wav MIME type", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.wav" type="audio/wav" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast for audio/flac MIME type", () => {
      const feed = makeRssFeed([
        `<item><title>Episode</title><enclosure url="https://example.com/ep.flac" type="audio/flac" length="12345"/></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });
  });

  describe("iTunes episode-level tag variants", () => {
    it("returns podcast when feed has iTunes namespace and itunes:season tags", () => {
      const feed = makeItunesFeed([
        `<item><title>Episode 11</title><itunes:season>2</itunes:season></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns podcast when feed has iTunes namespace and itunes:episodeType tags", () => {
      const feed = makeItunesFeed([
        `<item><title>Episode 12</title><itunes:episodeType>full</itunes:episodeType></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("podcast");
    });

    it("returns rss for iTunes namespace without any episode-level tags", () => {
      // Only channel-level itunes tags — no episode-level ones
      const feed = `${itunesHeader}<itunes:author>Someone</itunes:author><item><title>Post</title></item>${rssFooter}`;
      expect(detectFeedSourceType(feed)).toBe("rss");
    });
  });

  describe("regression: non-audio file extension not mistaken for audio", () => {
    it("returns rss for a .mp3 string that appears only in a title, not an enclosure URL", () => {
      // The .mp3 substring appears in the title text, not in any enclosure url attribute
      const feed = makeRssFeed([
        `<item><title>Download episode.mp3</title><link>https://example.com/1</link></item>`,
      ]);
      expect(detectFeedSourceType(feed)).toBe("rss");
    });
  });
});
