import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../server/utils/feedValidator", () => ({
  fetchFeedBody: vi.fn(),
  FEED_FETCH_PROXY_URL: "",
}));

vi.mock("../../../../server/utils/feedSourceDetector", () => ({
  detectFeedSource: vi.fn(),
}));

import handler from "../../../../server/api/feeds/detect.post";
import { fetchFeedBody } from "../../../../server/utils/feedValidator";
import { detectFeedSource } from "../../../../server/utils/feedSourceDetector";

const mockFetchFeedBody = vi.mocked(fetchFeedBody);
const mockDetectFeedSource = vi.mocked(detectFeedSource);

const RSS_BODY = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
const PODCAST_BODY = `<?xml version="1.0"?><rss version="2.0"><channel><item><enclosure url="ep.mp3" type="audio/mpeg"/></item></channel></rss>`;

describe("POST /api/feeds/detect", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchFeedBody.mockResolvedValue(RSS_BODY);
    mockDetectFeedSource.mockReturnValue("rss");
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

  it("returns detectedSource rss for a plain feed", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    const result = await handler(event);
    expect(result).toEqual({ detectedSource: "rss" });
  });

  it("returns detectedSource podcast for a podcast feed", async () => {
    mockFetchFeedBody.mockResolvedValue(PODCAST_BODY);
    mockDetectFeedSource.mockReturnValue("podcast");
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://podcast.example.com/feed.xml" },
    };
    const result = await handler(event);
    expect(result).toEqual({ detectedSource: "podcast" });
  });

  it("calls fetchFeedBody with the trimmed URL", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { url: "  https://example.com/feed.xml  " },
    };
    await handler(event);
    expect(mockFetchFeedBody).toHaveBeenCalledWith(
      "https://example.com/feed.xml",
      expect.any(Function),
    );
  });

  it("throws 422 when fetchFeedBody throws a non-abort error", async () => {
    mockFetchFeedBody.mockRejectedValue(new Error("Network error"));
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("throws 504 when fetchFeedBody throws an AbortError", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    mockFetchFeedBody.mockRejectedValue(abortError);
    const event = {
      context: { user: { id: 1 } },
      body: { url: "https://example.com/feed.xml" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 504 });
  });
});
