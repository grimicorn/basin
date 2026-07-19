import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../server/utils/feedCreation", () => ({
  createFeedForUser: vi.fn(),
}));

import handler from "../../../../server/api/feeds/import.post";
import { createFeedForUser } from "../../../../server/utils/feedCreation";

const mockCreateFeedForUser = vi.mocked(createFeedForUser);

const defaultReadBody = globalThis.readBody;

function makeEvent(user: unknown = { id: 1 }, body: unknown = {}) {
  return { context: { user }, body };
}

const VALID_OPML = `<opml><body>
  <outline title="Feed One" xmlUrl="https://one.example.com/feed.xml"/>
  <outline title="Feed Two" xmlUrl="https://two.example.com/feed.xml"/>
</body></opml>`;

describe("POST /api/feeds/import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.readBody = defaultReadBody;
  });

  afterEach(() => {
    globalThis.readBody = defaultReadBody;
  });

  it("throws 401 when unauthenticated", async () => {
    const event = makeEvent(null, { opml: VALID_OPML });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when opml is missing", async () => {
    await expect(handler(makeEvent({ id: 1 }, {}))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when opml is blank", async () => {
    await expect(
      handler(makeEvent({ id: 1 }, { opml: "   " })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when the document is not valid OPML", async () => {
    await expect(
      handler(makeEvent({ id: 1 }, { opml: "not opml at all" })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("adds every feed outline via createFeedForUser and returns them as imported", async () => {
    mockCreateFeedForUser.mockImplementation(async (userId, url) => ({
      id: url.includes("one") ? 1 : 2,
      userId,
      url,
      title: null,
      source: "rss",
      sourceOverride: null,
      detectedSource: "rss",
    }));

    const result = await handler(makeEvent({ id: 1 }, { opml: VALID_OPML }));

    expect(mockCreateFeedForUser).toHaveBeenCalledWith(
      1,
      "https://one.example.com/feed.xml",
    );
    expect(mockCreateFeedForUser).toHaveBeenCalledWith(
      1,
      "https://two.example.com/feed.xml",
    );
    expect(result.imported).toHaveLength(2);
    expect(result.skipped).toEqual([]);
  });

  it("skips feeds that fail validation instead of aborting the whole import", async () => {
    mockCreateFeedForUser.mockImplementation(async (userId, url) => {
      if (url.includes("two")) {
        throw Object.assign(new Error("URL does not point to a valid feed"), {
          statusCode: 422,
          statusMessage: "URL does not point to a valid feed",
        });
      }
      return {
        id: 1,
        userId,
        url,
        title: null,
        source: "rss",
        sourceOverride: null,
        detectedSource: "rss",
      };
    });

    const result = await handler(makeEvent({ id: 1 }, { opml: VALID_OPML }));

    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toEqual([
      {
        url: "https://two.example.com/feed.xml",
        title: "Feed Two",
        reason: "URL does not point to a valid feed",
      },
    ]);
  });

  it("returns an empty result for OPML with no feed outlines", async () => {
    const result = await handler(
      makeEvent(
        { id: 1 },
        { opml: `<opml><body><outline text="Empty Folder"/></body></opml>` },
      ),
    );

    expect(result).toEqual({ imported: [], skipped: [] });
    expect(mockCreateFeedForUser).not.toHaveBeenCalled();
  });
});
