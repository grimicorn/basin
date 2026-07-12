import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @atproto/api before importing the module under test.
const mockLogin = vi.fn();
const mockResumeSession = vi.fn();
const mockGetTimeline = vi.fn();

vi.mock("@atproto/api", () => {
  class MockCredentialSession {
    login = mockLogin;
    resumeSession = mockResumeSession;
  }

  class MockAgent {
    session: MockCredentialSession;

    constructor(session: MockCredentialSession) {
      this.session = session;
    }

    getTimeline = mockGetTimeline;
  }

  return { CredentialSession: MockCredentialSession, Agent: MockAgent };
});

import {
  buildPermalinkFromUri,
  deriveTitleFromText,
  resolvePostImageUrl,
  shouldIncludePost,
  DEFAULT_POST_FILTER_POLICY,
  createAgentSession,
  fetchNewBlueskyPosts,
} from "../../../server/utils/blueskyAdapter";
import type {
  BlueskyCredentials,
  PostFilterPolicy,
} from "../../../server/utils/blueskyAdapter";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeCredentials(
  overrides: Partial<BlueskyCredentials> = {},
): BlueskyCredentials {
  return {
    identifier: "alice.bsky.social",
    appPassword: "xxxx-xxxx-xxxx-xxxx",
    accessJwt: "access-jwt",
    refreshJwt: "refresh-jwt",
    did: "did:plc:abc123",
    ...overrides,
  };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    post: {
      uri: "at://did:plc:abc123/app.bsky.feed.post/3kp123",
      cid: "bafyreid123",
      author: {
        did: "did:plc:abc123",
        handle: "alice.bsky.social",
        displayName: "Alice",
      },
      record: {
        $type: "app.bsky.feed.post",
        text: "Hello Bluesky!",
        createdAt: "2024-06-01T10:00:00.000Z",
      },
      embed: null,
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
      indexedAt: "2024-06-01T10:00:01.000Z",
    },
    ...overrides,
  };
}

function makeRepost(overrides: Record<string, unknown> = {}) {
  return makePost({
    reason: {
      $type: "app.bsky.feed.defs#reasonRepost",
      by: { did: "did:plc:xyz", handle: "bob.bsky.social" },
      indexedAt: "2024-06-01T11:00:00.000Z",
    },
    ...overrides,
  });
}

function makeReply(overrides: Record<string, unknown> = {}) {
  return makePost({
    post: {
      ...makePost().post,
      record: {
        $type: "app.bsky.feed.post",
        text: "In reply to you",
        createdAt: "2024-06-01T10:30:00.000Z",
        reply: {
          root: {
            uri: "at://did:plc:root/app.bsky.feed.post/abc",
            cid: "cid1",
          },
          parent: {
            uri: "at://did:plc:parent/app.bsky.feed.post/def",
            cid: "cid2",
          },
        },
      },
    },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// permalink construction
// ---------------------------------------------------------------------------

describe("buildPermalinkFromUri", () => {
  it("builds a bsky.app permalink from handle and AT URI", () => {
    const permalink = buildPermalinkFromUri(
      "alice.bsky.social",
      "at://did:plc:abc123/app.bsky.feed.post/3kp123",
    );
    expect(permalink).toBe(
      "https://bsky.app/profile/alice.bsky.social/post/3kp123",
    );
  });

  it("parses the rkey from the last segment of the AT URI", () => {
    const permalink = buildPermalinkFromUri(
      "bob.bsky.social",
      "at://did:plc:xyz/app.bsky.feed.post/rkey999",
    );
    expect(permalink).toBe(
      "https://bsky.app/profile/bob.bsky.social/post/rkey999",
    );
  });

  it("never stores the raw at:// URI as the user-facing link", () => {
    const permalink = buildPermalinkFromUri(
      "alice.bsky.social",
      "at://did:plc:abc123/app.bsky.feed.post/3kp123",
    );
    expect(permalink).not.toContain("at://");
  });
});

// ---------------------------------------------------------------------------
// title derivation
// ---------------------------------------------------------------------------

describe("deriveTitleFromText", () => {
  it("returns the text when it is shorter than the max", () => {
    expect(deriveTitleFromText("Short post")).toBe("Short post");
  });

  it("truncates at 100 characters and appends ellipsis", () => {
    const longText = "A".repeat(120);
    const title = deriveTitleFromText(longText);
    expect(title.length).toBeLessThanOrEqual(101); // 100 chars + ellipsis char
    expect(title.endsWith("…")).toBe(true);
  });

  it("uses only the first line when text has newlines", () => {
    const multiLine = "First line\nSecond line\nThird line";
    expect(deriveTitleFromText(multiLine)).toBe("First line");
  });

  it("falls back to (untitled) when text is empty", () => {
    expect(deriveTitleFromText("")).toBe("(untitled)");
  });
});

// ---------------------------------------------------------------------------
// embed image URL resolution
// ---------------------------------------------------------------------------

describe("resolvePostImageUrl", () => {
  it("returns null when there is no embed", () => {
    const post = makePost().post;
    expect(resolvePostImageUrl(post as any)).toBeNull();
  });

  it("returns the thumb from an images embed", () => {
    const post = {
      ...makePost().post,
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [
          { thumb: "https://cdn.bsky.app/img/thumb/abc.jpg", alt: "photo" },
        ],
      },
    };
    expect(resolvePostImageUrl(post as any)).toBe(
      "https://cdn.bsky.app/img/thumb/abc.jpg",
    );
  });

  it("returns the first image thumb when multiple images are present", () => {
    const post = {
      ...makePost().post,
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [
          { thumb: "https://cdn.bsky.app/first.jpg", alt: "first" },
          { thumb: "https://cdn.bsky.app/second.jpg", alt: "second" },
        ],
      },
    };
    expect(resolvePostImageUrl(post as any)).toBe(
      "https://cdn.bsky.app/first.jpg",
    );
  });

  it("returns the thumb from an external card embed", () => {
    const post = {
      ...makePost().post,
      embed: {
        $type: "app.bsky.embed.external#view",
        external: {
          uri: "https://example.com",
          title: "Example",
          description: "A link card",
          thumb: "https://example.com/og-image.png",
        },
      },
    };
    expect(resolvePostImageUrl(post as any)).toBe(
      "https://example.com/og-image.png",
    );
  });

  it("returns null for unknown embed types", () => {
    const post = {
      ...makePost().post,
      embed: { $type: "app.bsky.embed.record#view", record: {} },
    };
    expect(resolvePostImageUrl(post as any)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// post filter policy
// ---------------------------------------------------------------------------

describe("shouldIncludePost", () => {
  const permissivePolicy: PostFilterPolicy = {
    includeReposts: true,
    includeReplies: true,
  };

  it("includes a top-level post under the default policy", () => {
    expect(
      shouldIncludePost(makePost() as any, DEFAULT_POST_FILTER_POLICY),
    ).toBe(true);
  });

  it("excludes a repost under the default policy (includeReposts: false)", () => {
    expect(
      shouldIncludePost(makeRepost() as any, DEFAULT_POST_FILTER_POLICY),
    ).toBe(false);
  });

  it("excludes a reply under the default policy (includeReplies: false)", () => {
    expect(
      shouldIncludePost(makeReply() as any, DEFAULT_POST_FILTER_POLICY),
    ).toBe(false);
  });

  it("includes a repost when includeReposts is true", () => {
    expect(shouldIncludePost(makeRepost() as any, permissivePolicy)).toBe(true);
  });

  it("includes a reply when includeReplies is true", () => {
    expect(shouldIncludePost(makeReply() as any, permissivePolicy)).toBe(true);
  });

  it("excludes reposts even if includeReplies is true", () => {
    const repostOnlyExcluded: PostFilterPolicy = {
      includeReposts: false,
      includeReplies: true,
    };
    expect(shouldIncludePost(makeRepost() as any, repostOnlyExcluded)).toBe(
      false,
    );
  });

  it("excludes replies even if includeReposts is true", () => {
    const replyOnlyExcluded: PostFilterPolicy = {
      includeReposts: true,
      includeReplies: false,
    };
    expect(shouldIncludePost(makeReply() as any, replyOnlyExcluded)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// createAgentSession — session create vs resume vs re-auth-on-expiry
// ---------------------------------------------------------------------------

describe("createAgentSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls resumeSession with the stored JWTs", async () => {
    mockResumeSession.mockResolvedValue(undefined);

    await createAgentSession(makeCredentials());

    expect(mockResumeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessJwt: "access-jwt",
        refreshJwt: "refresh-jwt",
        did: "did:plc:abc123",
      }),
    );
  });

  it("does not call login when resumeSession succeeds", async () => {
    mockResumeSession.mockResolvedValue(undefined);

    await createAgentSession(makeCredentials());

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("falls back to login with app password when resumeSession throws", async () => {
    mockResumeSession.mockRejectedValue(new Error("Session expired"));
    mockLogin.mockResolvedValue(undefined);

    await createAgentSession(makeCredentials());

    expect(mockLogin).toHaveBeenCalledWith({
      identifier: "alice.bsky.social",
      password: "xxxx-xxxx-xxxx-xxxx",
    });
  });

  it("re-authenticates using the app password, not the JWTs", async () => {
    mockResumeSession.mockRejectedValue(new Error("Expired"));
    mockLogin.mockResolvedValue(undefined);

    const credentials = makeCredentials({ appPassword: "my-app-password" });
    await createAgentSession(credentials);

    expect(mockLogin).toHaveBeenCalledWith({
      identifier: "alice.bsky.social",
      password: "my-app-password",
    });
  });
});

// ---------------------------------------------------------------------------
// fetchNewBlueskyPosts — watermark pagination and policy
// ---------------------------------------------------------------------------

describe("fetchNewBlueskyPosts", () => {
  const FEED_ID = 10;

  function makePagedTimeline(
    postDates: string[],
    cursor?: string,
  ): { feed: ReturnType<typeof makePost>[]; cursor?: string } {
    return {
      feed: postDates.map((date) =>
        makePost({
          post: {
            ...makePost().post,
            // Set indexedAt to the same value as createdAt so watermark logic
            // (which prefers indexedAt) behaves deterministically in tests.
            indexedAt: date,
            record: {
              $type: "app.bsky.feed.post",
              text: `Post from ${date}`,
              createdAt: date,
            },
          },
        }),
      ),
      cursor,
    };
  }

  const mockDeps = {
    createSession: vi.fn().mockResolvedValue({}),
    getTimeline: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockDeps.createSession.mockResolvedValue({});
  });

  it("returns only posts after the watermark", async () => {
    const watermark = new Date("2024-06-01T09:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce(
      makePagedTimeline([
        "2024-06-01T10:00:00.000Z", // after watermark — include
        "2024-06-01T08:00:00.000Z", // before watermark — stop
      ]),
    );

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(1);
    expect(items[0].publishedAt).toEqual(new Date("2024-06-01T10:00:00.000Z"));
  });

  it("stops paging once a post predates the watermark", async () => {
    const watermark = new Date("2024-06-01T09:00:00.000Z");

    mockDeps.getTimeline
      .mockResolvedValueOnce(
        makePagedTimeline(
          [
            "2024-06-01T10:00:00.000Z", // after watermark
            "2024-06-01T08:00:00.000Z", // before watermark — stop here
          ],
          "next-cursor",
        ),
      )
      .mockResolvedValueOnce(
        makePagedTimeline(["2024-06-01T07:00:00.000Z"]), // should never be fetched
      );

    await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    // Second page must not be fetched because we stopped at the watermark.
    expect(mockDeps.getTimeline).toHaveBeenCalledTimes(1);
  });

  it("fetches multiple pages when all posts are after the watermark", async () => {
    const watermark = new Date("2024-05-31T00:00:00.000Z");

    mockDeps.getTimeline
      .mockResolvedValueOnce(
        makePagedTimeline(
          ["2024-06-01T10:00:00.000Z", "2024-06-01T09:00:00.000Z"],
          "cursor-page-2",
        ),
      )
      .mockResolvedValueOnce(
        makePagedTimeline(["2024-06-01T08:00:00.000Z"]), // no cursor — last page
      );

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(3);
    expect(mockDeps.getTimeline).toHaveBeenCalledTimes(2);
  });

  it("includes all posts on first sync when lastSyncedAt is null", async () => {
    mockDeps.getTimeline.mockResolvedValueOnce(
      makePagedTimeline([
        "2024-06-01T10:00:00.000Z",
        "2020-01-01T00:00:00.000Z", // very old — still included
      ]),
    );

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      null,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(2);
  });

  it("filters out reposts by default", async () => {
    const watermark = new Date("2024-05-31T00:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [
        makePost({
          post: {
            ...makePost().post,
            record: {
              $type: "app.bsky.feed.post",
              text: "Top-level post",
              createdAt: "2024-06-01T10:00:00.000Z",
            },
          },
        }),
        makeRepost(),
      ],
    });

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(1);
    expect(items[0].content).toBe("Top-level post");
  });

  it("filters out replies by default", async () => {
    const watermark = new Date("2024-05-31T00:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [makeReply()],
    });

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(0);
  });

  it("includes reposts when policy allows", async () => {
    const watermark = new Date("2024-05-31T00:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [makeRepost()],
    });

    const permissivePolicy: PostFilterPolicy = {
      includeReposts: true,
      includeReplies: false,
    };

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      permissivePolicy,
      mockDeps,
    );

    expect(items).toHaveLength(1);
  });

  it("maps the AT URI to a bsky.app permalink (not an at:// URI)", async () => {
    const watermark = new Date("2024-05-31T00:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [
        makePost({
          post: {
            uri: "at://did:plc:abc123/app.bsky.feed.post/3kp123",
            cid: "cid",
            author: {
              did: "did:plc:abc123",
              handle: "alice.bsky.social",
              displayName: "Alice",
            },
            record: {
              $type: "app.bsky.feed.post",
              text: "Test post",
              createdAt: "2024-06-01T10:00:00.000Z",
            },
            embed: null,
            replyCount: 0,
            repostCount: 0,
            likeCount: 0,
            indexedAt: "2024-06-01T10:00:01.000Z",
          },
        }),
      ],
    });

    const [item] = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(item.url).toBe(
      "https://bsky.app/profile/alice.bsky.social/post/3kp123",
    );
    expect(item.url).not.toContain("at://");
  });

  it("sets guid to the AT URI", async () => {
    const watermark = new Date("2024-05-31T00:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [makePost()],
    });

    const [item] = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(item.guid).toBe("at://did:plc:abc123/app.bsky.feed.post/3kp123");
  });

  it("leaves new posts unsaved and unread by default", async () => {
    const watermark = new Date("2024-05-31T00:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [makePost()],
    });

    const [item] = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(item.savedAt).toBeNull();
    expect(item.readAt).toBeNull();
    expect(item.starred).toBe(false);
  });

  it("returns an empty array when the timeline is empty", async () => {
    mockDeps.getTimeline.mockResolvedValueOnce({ feed: [] });

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      new Date(),
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(0);
  });

  it("uses indexedAt (server-assigned) rather than record.createdAt for the watermark cutoff", async () => {
    // indexedAt is before the watermark but createdAt is after — post should be excluded
    // because the server says it was indexed before the watermark.
    const watermark = new Date("2024-06-01T12:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [
        makePost({
          post: {
            ...makePost().post,
            indexedAt: "2024-06-01T11:00:00.000Z", // server-assigned — before watermark
            record: {
              $type: "app.bsky.feed.post",
              text: "Future-dated post",
              createdAt: "2024-06-01T13:00:00.000Z", // client-authored — after watermark
            },
          },
        }),
      ],
    });

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(0);
  });

  it("includes a post at the exact watermark boundary (>= comparison)", async () => {
    const watermark = new Date("2024-06-01T10:00:00.000Z");

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [
        makePost({
          post: {
            ...makePost().post,
            indexedAt: "2024-06-01T10:00:00.000Z", // exactly at the watermark
            record: {
              $type: "app.bsky.feed.post",
              text: "Boundary post",
              createdAt: "2024-06-01T10:00:00.000Z",
            },
          },
        }),
      ],
    });

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(1);
  });

  it("falls back to record.createdAt when indexedAt is absent", async () => {
    const watermark = new Date("2024-06-01T09:00:00.000Z");

    const postWithoutIndexedAt = makePost({
      post: {
        ...makePost().post,
        indexedAt: undefined,
        record: {
          $type: "app.bsky.feed.post",
          text: "No indexedAt post",
          createdAt: "2024-06-01T10:00:00.000Z",
        },
      },
    });

    mockDeps.getTimeline.mockResolvedValueOnce({
      feed: [postWithoutIndexedAt],
    });

    const items = await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(items).toHaveLength(1);
  });

  it("stops fetching after 100 pages to prevent serverless timeout", async () => {
    const watermark = new Date("2020-01-01T00:00:00.000Z");

    // Every page returns a post after the watermark and a cursor so pagination
    // would continue indefinitely without a cap.
    mockDeps.getTimeline.mockResolvedValue(
      makePagedTimeline(["2024-06-01T10:00:00.000Z"], "next-cursor"),
    );

    await fetchNewBlueskyPosts(
      makeCredentials(),
      FEED_ID,
      watermark,
      DEFAULT_POST_FILTER_POLICY,
      mockDeps,
    );

    expect(mockDeps.getTimeline).toHaveBeenCalledTimes(100);
  });
});
