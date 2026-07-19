import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockFindFirst,
  mockUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockInsert,
  mockInsertValues,
  mockInsertOnConflict,
  mockInsertReturning,
  mockParseRssFeed,
  mockParsePodcastFeed,
  mockFetchNewUploadsForChannel,
  mockIsTokenExpired,
  mockRefreshAccessToken,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockInsert: vi.fn(),
  mockInsertValues: vi.fn(),
  mockInsertOnConflict: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockParseRssFeed: vi.fn(),
  mockParsePodcastFeed: vi.fn(),
  mockFetchNewUploadsForChannel: vi.fn(),
  mockIsTokenExpired: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
}));

vi.mock("../../../netlify/functions/db", () => ({
  createDb: vi.fn(() => ({
    query: {
      feeds: { findFirst: mockFindFirst },
      integrations: { findFirst: mockFindFirst },
    },
    update: mockUpdate,
    insert: mockInsert,
  })),
}));

vi.mock("../../../server/utils/rssAdapter", () => ({
  parseRssFeed: mockParseRssFeed,
}));

vi.mock("../../../server/utils/podcastAdapter", () => ({
  parsePodcastFeed: mockParsePodcastFeed,
}));

vi.mock("../../../server/utils/youtubeAdapter", () => ({
  isTokenExpired: mockIsTokenExpired,
  refreshAccessToken: mockRefreshAccessToken,
  fetchNewUploadsForChannel: mockFetchNewUploadsForChannel,
}));

// Mock async-workloads — asyncWorkloadFn is an identity wrapper in tests
vi.mock("@netlify/async-workloads", () => ({
  asyncWorkloadFn: (fn: Function) => fn,
  ErrorDoNotRetry: class ErrorDoNotRetry extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ErrorDoNotRetry";
    }
  },
  ErrorRetryAfterDelay: class ErrorRetryAfterDelay extends Error {
    constructor(opts: { message: string }) {
      super(opts.message);
      this.name = "ErrorRetryAfterDelay";
    }
  },
}));

import handler from "../../../netlify/functions/sync-feed";

function recentFetch() {
  return new Date(Date.now() - 60_000); // 1 minute ago
}

function staleFetch() {
  return new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
}

function makeFeed(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    url: "https://example.com/feed.xml",
    title: null,
    source: "rss",
    lastFetched: null,
    ...overrides,
  };
}

function makeYouTubeFeed(overrides: Record<string, unknown> = {}) {
  return {
    id: 2,
    url: "UCxxxxxx",
    title: "Test Channel",
    source: "youtube",
    lastFetched: null,
    ...overrides,
  };
}

function makeIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    accessToken: "valid-access-token",
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 3_600_000),
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventName: "sync-feed" as const,
    eventData: {
      userId: 1,
      feedId: 1,
      sourceType: "rss" as const,
      mode: "scheduled" as const,
    },
    eventId: "evt-1",
    attempt: 0,
    ...overrides,
  };
}

function makeYouTubeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventName: "sync-feed" as const,
    eventData: {
      userId: 1,
      feedId: 2,
      sourceType: "youtube" as const,
      mode: "scheduled" as const,
    },
    eventId: "evt-2",
    attempt: 0,
    ...overrides,
  };
}

function makeVideoItem() {
  return {
    feedId: 2,
    guid: "UCxxxxxx-vid123",
    title: "Test Video",
    url: "https://youtube.com/watch?v=vid123",
    author: "Test Channel",
    content: "Video description",
    imageUrl: "https://img.youtube.com/vi/vid123/hqdefault.jpg",
    publishedAt: new Date("2024-06-01T12:00:00Z"),
    savedAt: null,
    readAt: null,
    starred: false,
    tags: null,
    searchVector: null,
  };
}

describe("sync-feed workload", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Silence the workload's structured JSON event logs so they don't clutter
    // test output. Set after resetAllMocks so the reset doesn't clear the spies.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);

    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({
      onConflictDoNothing: mockInsertOnConflict,
    });
    mockInsertOnConflict.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([{ id: 10 }, { id: 11 }]);

    mockParseRssFeed.mockResolvedValue([
      {
        feedId: 1,
        guid: "urn:1",
        title: "Item 1",
        url: "https://example.com/1",
        author: "Alice",
        content: "Content",
        imageUrl: null,
        publishedAt: new Date(),
        savedAt: null,
        readAt: null,
        starred: false,
        tags: null,
        searchVector: null,
        mediaUrl: null,
        mediaDuration: null,
      },
    ]);

    mockParsePodcastFeed.mockResolvedValue([
      {
        feedId: 1,
        guid: "urn:podcast:1",
        title: "Episode 1",
        url: "https://example.com/ep/1",
        author: "My Podcast",
        content: "Episode summary.",
        imageUrl: "https://example.com/art.jpg",
        publishedAt: new Date(),
        savedAt: null,
        readAt: null,
        starred: false,
        tags: null,
        searchVector: null,
        mediaUrl: "https://cdn.example.com/ep1.mp3",
        mediaDuration: 2730,
      },
    ]);
  });

  it("syncs an RSS feed and marks it synced", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: staleFetch() }));

    await (handler as Function)(makeEvent());

    expect(mockParseRssFeed).toHaveBeenCalledWith(
      "https://example.com/feed.xml",
      1,
    );
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("no-ops when within debounce window in scheduled mode", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: recentFetch() }));

    await (handler as Function)(
      makeEvent({
        eventData: {
          userId: 1,
          feedId: 1,
          sourceType: "rss",
          mode: "scheduled",
        },
      }),
    );

    expect(mockParseRssFeed).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does NOT debounce on-demand syncs even when recently fetched", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: recentFetch() }));

    await (handler as Function)(
      makeEvent({
        eventData: {
          userId: 1,
          feedId: 1,
          sourceType: "rss",
          mode: "on-demand",
        },
      }),
    );

    expect(mockParseRssFeed).toHaveBeenCalledTimes(1);
  });

  it("throws ErrorDoNotRetry for an unsupported sourceType", async () => {
    await expect(
      (handler as Function)(
        makeEvent({
          eventData: {
            userId: 1,
            feedId: 1,
            sourceType: "twitter",
            mode: "scheduled",
          },
        }),
      ),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });
  });

  it("throws ErrorDoNotRetry when the feed is not found", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await expect((handler as Function)(makeEvent())).rejects.toMatchObject({
      name: "ErrorDoNotRetry",
    });
  });

  it("throws ErrorDoNotRetry when event sourceType does not match db source", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ source: "podcast" }));

    await expect(
      (handler as Function)(
        makeEvent({
          eventData: {
            userId: 1,
            feedId: 1,
            sourceType: "rss",
            mode: "scheduled",
          },
        }),
      ),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });
  });

  it("throws ErrorRetryAfterDelay when RSS fetch fails on early attempts", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockRejectedValue(new Error("Network timeout"));

    await expect(
      (handler as Function)(makeEvent({ attempt: 1 })),
    ).rejects.toMatchObject({ name: "ErrorRetryAfterDelay" });
  });

  it("throws ErrorDoNotRetry after max retries", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockRejectedValue(new Error("Persistent failure"));

    await expect(
      (handler as Function)(makeEvent({ attempt: 4 })),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });
  });

  it("does not call markFeedSynced when upsert fails", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockRejectedValue(new Error("Parse error"));

    await expect(
      (handler as Function)(makeEvent({ attempt: 0 })),
    ).rejects.toBeDefined();
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("skips insert when adapter returns no items", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockResolvedValue([]);

    await (handler as Function)(makeEvent());

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("dispatches to parsePodcastFeed for a podcast source", async () => {
    mockFindFirst.mockResolvedValue(
      makeFeed({ source: "podcast", lastFetched: null }),
    );

    await (handler as Function)(
      makeEvent({
        eventData: {
          userId: 1,
          feedId: 1,
          sourceType: "podcast",
          mode: "scheduled",
        },
      }),
    );

    expect(mockParsePodcastFeed).toHaveBeenCalledWith(
      "https://example.com/feed.xml",
      1,
    );
    expect(mockParseRssFeed).not.toHaveBeenCalled();
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("does NOT dispatch parsePodcastFeed for an RSS source", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));

    await (handler as Function)(makeEvent());

    expect(mockParseRssFeed).toHaveBeenCalledTimes(1);
    expect(mockParsePodcastFeed).not.toHaveBeenCalled();
  });

  it("marks the feed synced with a timestamp captured before the adapter runs", async () => {
    // Verify that the timestamp passed to markFeedSynced is not later than the
    // moment the handler was called — i.e. it reflects the sync start, not completion.
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: staleFetch() }));

    const beforeCall = new Date();
    await (handler as Function)(makeEvent());
    const afterCall = new Date();

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastFetched: expect.any(Date),
      }),
    );

    const syncedAt: Date = mockUpdateSet.mock.calls[0][0].lastFetched;
    expect(syncedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(syncedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });
});

// --- YouTube branch ---

describe("sync-feed workload — YouTube source", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.resetAllMocks();

    // Silence the workload's structured JSON event logs so they don't clutter
    // test output. Set after resetAllMocks so the reset doesn't clear the spies.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);

    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({
      onConflictDoNothing: mockInsertOnConflict,
    });
    mockInsertOnConflict.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([{ id: 20 }]);

    mockIsTokenExpired.mockReturnValue(false);
    mockFetchNewUploadsForChannel.mockResolvedValue([makeVideoItem()]);
  });

  it("syncs a YouTube feed when the integration exists and token is valid", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed({ lastFetched: staleFetch() }))
      .mockResolvedValueOnce(makeIntegration());

    await (handler as Function)(makeYouTubeEvent());

    expect(mockFetchNewUploadsForChannel).toHaveBeenCalledWith(
      "UCxxxxxx",
      2,
      "Test Channel",
      expect.any(Date),
    );
    // Feed sync-status update + integration sync-status update.
    expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
  });

  it("refreshes an expired token and persists it before fetching uploads", async () => {
    const expiredIntegration = makeIntegration({
      expiresAt: new Date(Date.now() - 1000),
    });

    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(expiredIntegration);

    mockIsTokenExpired.mockReturnValue(true);
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: "fresh-token",
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    vi.stubEnv("NUXT_GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("NUXT_GOOGLE_CLIENT_SECRET", "test-client-secret");

    await (handler as Function)(makeYouTubeEvent());

    expect(mockRefreshAccessToken).toHaveBeenCalledWith(
      "refresh-token",
      "test-client-id",
      "test-client-secret",
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "fresh-token" }),
    );
    expect(mockFetchNewUploadsForChannel).toHaveBeenCalled();
  });

  it("throws ErrorDoNotRetry when no YouTube integration exists for the user", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(undefined);

    await expect(
      (handler as Function)(makeYouTubeEvent()),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });

    expect(mockFetchNewUploadsForChannel).not.toHaveBeenCalled();
  });

  it("throws IntegrationAuthError (a non-retryable failure) when token is expired and no refresh token is stored", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(makeIntegration({ refreshToken: null }));

    mockIsTokenExpired.mockReturnValue(true);

    // IntegrationAuthError extends ErrorDoNotRetry — this failure is
    // specifically attributable to the connected account, which is what
    // lets persistPermanentSyncFailure mark the integration as well as the
    // feed (see the "permanent failure persistence" describe block below).
    await expect(
      (handler as Function)(makeYouTubeEvent()),
    ).rejects.toMatchObject({ name: "IntegrationAuthError" });
  });

  it("throws ServerConfigError (not persisted) when the Google OAuth client env vars are missing", async () => {
    const expiredIntegration = makeIntegration({
      expiresAt: new Date(Date.now() - 1000),
    });

    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(expiredIntegration);

    mockIsTokenExpired.mockReturnValue(true);
    vi.stubEnv("NUXT_GOOGLE_CLIENT_ID", "");
    vi.stubEnv("NUXT_GOOGLE_CLIENT_SECRET", "");

    await expect(
      (handler as Function)(makeYouTubeEvent()),
    ).rejects.toMatchObject({ name: "ServerConfigError" });

    // A missing server-side OAuth secret is not the user's fault — nothing
    // should be written to the feed or the integration for it.
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("throws ErrorRetryAfterDelay when the channel RSS fetch fails on early attempts", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(makeIntegration());

    mockFetchNewUploadsForChannel.mockRejectedValue(
      new Error(
        "Channel RSS fetch failed for UCxxxxxx: 503 Service Unavailable",
      ),
    );

    await expect(
      (handler as Function)(makeYouTubeEvent({ attempt: 1 })),
    ).rejects.toMatchObject({ name: "ErrorRetryAfterDelay" });
  });

  it("throws ErrorDoNotRetry when the channel RSS fetch fails after max retries", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(makeIntegration());

    mockFetchNewUploadsForChannel.mockRejectedValue(
      new Error("Persistent failure"),
    );

    await expect(
      (handler as Function)(makeYouTubeEvent({ attempt: 4 })),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });
  });

  it("skips insert and still marks feed synced when no new uploads exist", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed({ lastFetched: staleFetch() }))
      .mockResolvedValueOnce(makeIntegration());

    mockFetchNewUploadsForChannel.mockResolvedValue([]);

    await (handler as Function)(makeYouTubeEvent());

    expect(mockInsert).not.toHaveBeenCalled();
    // Feed sync-status update + integration sync-status update.
    expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
  });

  it("debounces YouTube feeds within the debounce window in scheduled mode", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeYouTubeFeed({ lastFetched: new Date(Date.now() - 60_000) }),
    );

    await (handler as Function)(makeYouTubeEvent());

    expect(mockFetchNewUploadsForChannel).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// --- Permanent failure persistence (issue #110) ---

describe("sync-feed workload — permanent failure persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);

    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({
      onConflictDoNothing: mockInsertOnConflict,
    });
    mockInsertOnConflict.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([]);

    mockParseRssFeed.mockResolvedValue([]);
    mockFetchNewUploadsForChannel.mockResolvedValue([]);
    mockIsTokenExpired.mockReturnValue(false);
  });

  it("persists the error state and message on the feed for a permanent failure", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ source: "podcast" }));

    await expect(
      (handler as Function)(
        makeEvent({
          eventData: {
            userId: 1,
            feedId: 1,
            sourceType: "rss",
            mode: "scheduled",
          },
        }),
      ),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        syncStatus: "error",
        syncError: expect.stringContaining("Source mismatch"),
        syncFailedAt: expect.any(Date),
      }),
    );
  });

  it("does not persist a failure state for a transient (retryable) error", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));
    mockParseRssFeed.mockRejectedValue(new Error("Network timeout"));

    await expect(
      (handler as Function)(makeEvent({ attempt: 1 })),
    ).rejects.toMatchObject({ name: "ErrorRetryAfterDelay" });

    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("does not mark any integration when no YouTube integration exists yet", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(undefined); // no YouTube integration found

    await expect(
      (handler as Function)(makeYouTubeEvent()),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });

    // Only the feed is updated. There is no integration row to mark as
    // "needs reconnect" — the user was never connected, which
    // SettingsConnections already communicates via connected: false.
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        syncStatus: "error",
        syncError: expect.stringContaining("No YouTube integration found"),
      }),
    );
  });

  it("also marks the backing integration when the token is expired with no refresh token", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(makeIntegration({ refreshToken: null }));
    mockIsTokenExpired.mockReturnValue(true);

    await expect(
      (handler as Function)(makeYouTubeEvent()),
    ).rejects.toMatchObject({ name: "IntegrationAuthError" });

    // One update for the feed, one for the integration: this is an
    // IntegrationAuthError, since the connected account genuinely needs
    // re-authorizing.
    expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        syncStatus: "error",
        syncError: expect.stringContaining("Re-connect your YouTube account"),
      }),
    );
  });

  it("does not mark the integration when retries are exhausted on a transient YouTube error", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(makeIntegration());
    mockFetchNewUploadsForChannel.mockRejectedValue(
      new Error("503 Service Unavailable"),
    );

    await expect(
      (handler as Function)(makeYouTubeEvent({ attempt: 4 })),
    ).rejects.toMatchObject({ name: "ErrorDoNotRetry" });

    // A network flake that exhausted its retries says nothing about the
    // connected account's health — only the feed is marked, not the
    // integration.
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("clears a previously-recorded failure on the next successful sync", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ lastFetched: null }));

    await (handler as Function)(makeEvent());

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        syncStatus: "ok",
        syncError: null,
        syncFailedAt: null,
      }),
    );
  });

  it("clears a previously-recorded integration failure on the next successful YouTube sync", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeYouTubeFeed())
      .mockResolvedValueOnce(makeIntegration());
    mockIsTokenExpired.mockReturnValue(false);
    mockFetchNewUploadsForChannel.mockResolvedValue([]);

    await (handler as Function)(makeYouTubeEvent());

    // Feed clear + integration clear.
    expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
    expect(mockUpdateSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        syncStatus: "ok",
        syncError: null,
        syncFailedAt: null,
      }),
    );
  });

  it("still surfaces the original sync failure when persisting the failure state itself errors", async () => {
    mockFindFirst.mockResolvedValue(makeFeed({ source: "podcast" }));
    mockUpdateWhere.mockRejectedValue(new Error("connection reset"));

    // The permanent failure is a source mismatch — persistence blowing up
    // must not replace it with the DB error, or the workload's blocked
    // state would be driven by an incidental infra failure.
    await expect(
      (handler as Function)(
        makeEvent({
          eventData: {
            userId: 1,
            feedId: 1,
            sourceType: "rss",
            mode: "scheduled",
          },
        }),
      ),
    ).rejects.toMatchObject({
      name: "ErrorDoNotRetry",
      message: expect.stringContaining("Source mismatch"),
    });
  });
});
