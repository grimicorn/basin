import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

vi.stubGlobal("useDb", () => ({ insert: mockInsert }));

vi.mock("../../../server/utils/feedValidator", () => ({
  validateFeedContent: vi.fn(),
  fetchFeedBody: vi.fn(),
  FEED_FETCH_PROXY_URL: "",
}));

vi.mock("../../../server/utils/feedSourceDetector", () => ({
  detectFeedSource: vi.fn(),
}));

import { createFeedForUser } from "../../../server/utils/feedCreation";
import {
  validateFeedContent,
  fetchFeedBody,
} from "../../../server/utils/feedValidator";
import { detectFeedSource } from "../../../server/utils/feedSourceDetector";

const mockValidateFeedContent = vi.mocked(validateFeedContent);
const mockFetchFeedBody = vi.mocked(fetchFeedBody);
const mockDetectFeedSource = vi.mocked(detectFeedSource);

const RSS_BODY = `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>`;

const mockFeed = {
  id: 1,
  url: "https://example.com/feed.xml",
  source: "rss",
  sourceOverride: null,
  userId: 1,
};

describe("createFeedForUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning });
    mockValidateFeedContent.mockResolvedValue(true);
    mockFetchFeedBody.mockResolvedValue(RSS_BODY);
    mockDetectFeedSource.mockReturnValue("rss");
    mockReturning.mockResolvedValue([mockFeed]);
  });

  it("inserts the feed and returns it with detectedSource", async () => {
    const result = await createFeedForUser(1, "https://example.com/feed.xml");
    expect(result).toMatchObject({ ...mockFeed, detectedSource: "rss" });
  });

  it("throws 422 when the URL does not point to a valid feed", async () => {
    mockValidateFeedContent.mockResolvedValue(false);
    await expect(
      createFeedForUser(1, "https://example.com/not-a-feed"),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("does not insert when validation fails", async () => {
    mockValidateFeedContent.mockResolvedValue(false);
    await expect(
      createFeedForUser(1, "https://example.com/not-a-feed"),
    ).rejects.toBeDefined();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("throws 504 when validation times out", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    mockValidateFeedContent.mockRejectedValue(abortError);

    await expect(
      createFeedForUser(1, "https://example.com/slow-feed"),
    ).rejects.toMatchObject({ statusCode: 504 });
  });

  it("uses sourceOverride when provided, ignoring detected source", async () => {
    mockDetectFeedSource.mockReturnValue("rss");
    const overriddenFeed = {
      ...mockFeed,
      source: "podcast",
      sourceOverride: "podcast",
    };
    mockReturning.mockResolvedValue([overriddenFeed]);

    await createFeedForUser(1, "https://example.com/feed.xml", "podcast");

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: "podcast", sourceOverride: "podcast" }),
    );
  });

  it("dedupes on userId + url via onConflictDoUpdate", async () => {
    await createFeedForUser(1, "https://example.com/feed.xml");
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(Array),
      }),
    );
  });
});
