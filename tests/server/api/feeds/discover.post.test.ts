import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("../../../../server/utils/feedDiscovery", () => ({
  discoverFeedUrl: vi.fn(),
}));

vi.mock("../../../../server/utils/urlValidator", () => ({
  validateFeedUrl: vi.fn(),
}));

import handler from "../../../../server/api/feeds/discover.post";
import { discoverFeedUrl } from "../../../../server/utils/feedDiscovery";
import { validateFeedUrl } from "../../../../server/utils/urlValidator";

const mockDiscoverFeedUrl = vi.mocked(discoverFeedUrl);
const mockValidateFeedUrl = vi.mocked(validateFeedUrl);

// The default readBody stub in tests/setup.ts resolves event.body.
// Override it per test when we need non-standard body shapes.
const defaultReadBody = globalThis.readBody;

function makeEvent(user: unknown = { id: 1 }, body: unknown = {}) {
  return { context: { user }, body };
}

describe("POST /api/feeds/discover", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.readBody = defaultReadBody;
    mockValidateFeedUrl.mockImplementation((url: string) =>
      Promise.resolve(url),
    );
  });

  afterEach(() => {
    globalThis.readBody = defaultReadBody;
  });

  it("throws 401 when unauthenticated", async () => {
    const event = makeEvent(null, { url: "https://example.com" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when body is null", async () => {
    globalThis.readBody = () => Promise.resolve(null);
    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when body is not an object", async () => {
    globalThis.readBody = () => Promise.resolve("https://example.com");
    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when body.url is missing", async () => {
    const event = makeEvent({ id: 1 }, { notUrl: "foo" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body.url is not a string", async () => {
    const event = makeEvent({ id: 1 }, { url: 42 });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body.url is an empty string", async () => {
    const event = makeEvent({ id: 1 }, { url: "" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body.url is a whitespace-only string", async () => {
    const event = makeEvent({ id: 1 }, { url: "   " });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 422 when no feed is found at the URL", async () => {
    mockDiscoverFeedUrl.mockResolvedValue(null);
    const event = makeEvent({ id: 1 }, { url: "https://example.com" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("returns the discovered feed URL", async () => {
    mockDiscoverFeedUrl.mockResolvedValue("https://example.com/feed.xml");
    const result = await handler(
      makeEvent({ id: 1 }, { url: "https://example.com" }),
    );
    expect(result).toEqual({ feedUrl: "https://example.com/feed.xml" });
  });

  it("trims whitespace from the URL before validating", async () => {
    mockDiscoverFeedUrl.mockResolvedValue("https://example.com/feed.xml");
    await handler(makeEvent({ id: 1 }, { url: "  https://example.com  " }));
    expect(mockValidateFeedUrl).toHaveBeenCalledWith("https://example.com");
  });
});
