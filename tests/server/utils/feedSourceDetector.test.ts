import { describe, it, expect } from "vitest";
import { detectFeedSource } from "../../../server/utils/feedSourceDetector";

const RSS_WRAPPER_OPEN = `<?xml version="1.0"?><rss version="2.0"><channel>`;
const RSS_WRAPPER_CLOSE = `</channel></rss>`;

function rss(inner: string): string {
  return `${RSS_WRAPPER_OPEN}${inner}${RSS_WRAPPER_CLOSE}`;
}

function atomFeed(inner: string): string {
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${inner}</feed>`;
}

function rssItem(enclosure: string): string {
  return `<item><title>Episode</title>${enclosure}</item>`;
}

describe("detectFeedSource", () => {
  describe("plain RSS feeds (no audio signals)", () => {
    it("returns rss for a feed with no enclosures", () => {
      const body = rss(
        `<item><title>Post</title><link>https://example.com/post</link></item>`,
      );
      expect(detectFeedSource(body)).toBe("rss");
    });

    it("returns rss for an empty feed", () => {
      const body = rss("");
      expect(detectFeedSource(body)).toBe("rss");
    });

    it("returns rss for a feed with an image enclosure", () => {
      const enclosure = `<enclosure url="https://example.com/image.jpg" type="image/jpeg" length="12345"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("rss");
    });

    it("returns rss for a feed with a PDF enclosure", () => {
      const enclosure = `<enclosure url="https://example.com/report.pdf" type="application/pdf" length="98765"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("rss");
    });

    it("returns rss when iTunes namespace is present but no episode elements", () => {
      const body = rss(
        `<title xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">My Blog</title>`,
      );
      expect(detectFeedSource(body)).toBe("rss");
    });
  });

  describe("RSS podcast feeds", () => {
    it("returns podcast for an audio/mpeg enclosure", () => {
      const enclosure = `<enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="123456"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast for an audio/mp4 enclosure", () => {
      const enclosure = `<enclosure url="https://example.com/ep1.m4a" type="audio/mp4" length="123456"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast for a video/mp4 enclosure", () => {
      const enclosure = `<enclosure url="https://example.com/ep1.mp4" type="video/mp4" length="123456"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast for an audio/* enclosure with uppercase MIME type", () => {
      const enclosure = `<enclosure url="https://example.com/ep1.mp3" type="Audio/MPEG" length="123456"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast when MIME is application/octet-stream but URL ends in .mp3", () => {
      const enclosure = `<enclosure url="https://example.com/ep1.mp3" type="application/octet-stream" length="123456"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast when MIME is application/octet-stream but URL ends in .m4a", () => {
      const enclosure = `<enclosure url="https://example.com/ep1.m4a" type="application/octet-stream" length="123456"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast when MIME is absent but URL ends in .mp3", () => {
      const enclosure = `<enclosure url="https://example.com/ep1.mp3" length="123456"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast when MIME is absent but URL ends in .aac", () => {
      const enclosure = `<enclosure url="https://cdn.example.com/ep2.aac?v=123" length="9999"/>`;
      const body = rss(rssItem(enclosure));
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast when iTunes namespace and itunes:duration are present", () => {
      const body = rss(
        `<title>My Podcast</title>` +
          `<item xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">` +
          `<title>Ep 1</title><itunes:duration>45:00</itunes:duration>` +
          `</item>`,
      );
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast when iTunes namespace and itunes:episode are present", () => {
      const body = rss(
        `<title>My Podcast</title>` +
          `<item xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">` +
          `<title>Ep 2</title><itunes:episode>2</itunes:episode>` +
          `</item>`,
      );
      expect(detectFeedSource(body)).toBe("podcast");
    });
  });

  describe("Atom feeds", () => {
    it("returns rss for an Atom feed with no enclosures", () => {
      const body = atomFeed(
        `<entry><title>Post</title><link href="https://example.com/post"/></entry>`,
      );
      expect(detectFeedSource(body)).toBe("rss");
    });

    it("returns podcast for an Atom feed with an audio enclosure link", () => {
      const body = atomFeed(
        `<entry><title>Ep 1</title>` +
          `<link rel="enclosure" href="https://example.com/ep1.mp3" type="audio/mpeg" length="123456"/>` +
          `</entry>`,
      );
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast for an Atom enclosure with video/* MIME type", () => {
      const body = atomFeed(
        `<entry><title>Ep 1</title>` +
          `<link rel="enclosure" href="https://example.com/ep1.mp4" type="video/mp4" length="999"/>` +
          `</entry>`,
      );
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns podcast for an Atom enclosure with octet-stream MIME but .mp3 extension", () => {
      const body = atomFeed(
        `<entry><title>Ep 1</title>` +
          `<link rel="enclosure" href="https://example.com/ep1.mp3" type="application/octet-stream" length="999"/>` +
          `</entry>`,
      );
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("returns rss for an Atom enclosure with image MIME type", () => {
      const body = atomFeed(
        `<entry><title>Post</title>` +
          `<link rel="enclosure" href="https://example.com/photo.jpg" type="image/jpeg" length="12345"/>` +
          `</entry>`,
      );
      expect(detectFeedSource(body)).toBe("rss");
    });
  });

  describe("edge cases", () => {
    it("returns rss for a completely empty string", () => {
      expect(detectFeedSource("")).toBe("rss");
    });

    it("returns rss for an HTML page that mentions audio", () => {
      const body = `<!DOCTYPE html><html><body><audio src="ep.mp3"></audio></body></html>`;
      expect(detectFeedSource(body)).toBe("rss");
    });

    it("only samples the first 5 enclosures — a podcast signal in item 1 is sufficient", () => {
      const audioItem = rssItem(
        `<enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="123456"/>`,
      );
      const body = rss(audioItem);
      expect(detectFeedSource(body)).toBe("podcast");
    });

    it("only samples the first 5 enclosures — audio in item 6 is not detected", () => {
      const imageItem = rssItem(
        `<enclosure url="https://example.com/image.jpg" type="image/jpeg" length="12345"/>`,
      );
      const audioItem = rssItem(
        `<enclosure url="https://example.com/ep6.mp3" type="audio/mpeg" length="123456"/>`,
      );
      // 5 image items followed by 1 audio item — the audio is beyond the sample window
      const body = rss(imageItem.repeat(5) + audioItem);
      expect(detectFeedSource(body)).toBe("rss");
    });
  });
});
