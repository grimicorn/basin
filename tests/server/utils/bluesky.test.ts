import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  createBlueskySession,
  fetchBlueskyTimeline,
} from "../../../server/utils/bluesky";

const mockSession = {
  did: "did:plc:abc123",
  handle: "you.bsky.social",
  accessJwt: "access-jwt-token",
  refreshJwt: "refresh-jwt-token",
};

describe("createBlueskySession", () => {
  beforeEach(() => vi.resetAllMocks());

  it("posts to the Bluesky createSession endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    await createBlueskySession("you.bsky.social", "xxxx-xxxx-xxxx-xxxx");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends handle and app password in the request body as JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    await createBlueskySession("you.bsky.social", "xxxx-xxxx-xxxx-xxxx");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      identifier: "you.bsky.social",
      password: "xxxx-xxxx-xxxx-xxxx",
    });
  });

  it("sets Content-Type to application/json", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    await createBlueskySession("you.bsky.social", "xxxx-xxxx-xxxx-xxxx");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("returns the parsed session object on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    const session = await createBlueskySession(
      "you.bsky.social",
      "xxxx-xxxx-xxxx-xxxx",
    );

    expect(session).toEqual(mockSession);
  });

  it("throws when the API returns a non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      createBlueskySession("you.bsky.social", "bad-password"),
    ).rejects.toThrow("Bluesky authentication failed: 401");
  });
});

const mockTimelineFeed = {
  feed: [
    {
      post: {
        uri: "at://did:plc:abc123/app.bsky.feed.post/1",
        cid: "bafyabc123",
        author: {
          did: "did:plc:abc123",
          handle: "someone.bsky.social",
          displayName: "Someone",
        },
        record: {
          text: "Hello Bluesky",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        likeCount: 5,
        repostCount: 2,
        indexedAt: "2024-01-01T00:00:00.000Z",
      },
    },
  ],
  cursor: "next-page-cursor",
};

describe("fetchBlueskyTimeline", () => {
  beforeEach(() => vi.resetAllMocks());

  it("fetches from the Bluesky getTimeline endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTimelineFeed),
    });

    await fetchBlueskyTimeline("access-jwt-token");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("app.bsky.feed.getTimeline"),
      expect.any(Object),
    );
  });

  it("sends the Authorization header with the Bearer token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTimelineFeed),
    });

    await fetchBlueskyTimeline("access-jwt-token");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer access-jwt-token" },
      }),
    );
  });

  it("includes the limit as a query parameter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTimelineFeed),
    });

    await fetchBlueskyTimeline("access-jwt-token", 25);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("limit=25"),
      expect.any(Object),
    );
  });

  it("uses the default limit of 50 when none is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTimelineFeed),
    });

    await fetchBlueskyTimeline("access-jwt-token");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("limit=50"),
      expect.any(Object),
    );
  });

  it("returns the parsed timeline feed on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTimelineFeed),
    });

    const result = await fetchBlueskyTimeline("access-jwt-token");

    expect(result).toEqual(mockTimelineFeed);
  });

  it("throws when the API returns a non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(fetchBlueskyTimeline("expired-jwt")).rejects.toThrow(
      "Bluesky timeline fetch failed: 401",
    );
  });
});
