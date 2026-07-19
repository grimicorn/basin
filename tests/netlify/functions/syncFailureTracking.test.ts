import { ErrorDoNotRetry } from "@netlify/async-workloads";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpdate, mockUpdateSet, mockUpdateWhere } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
}));

vi.mock("../../../netlify/functions/db", () => ({
  createDb: vi.fn(() => ({ update: mockUpdate })),
}));

import {
  providerForSourceType,
  IntegrationAuthError,
  persistPermanentSyncFailure,
  persistSyncSuccess,
} from "../../../netlify/functions/syncFailureTracking";

describe("syncFailureTracking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  describe("providerForSourceType()", () => {
    it("maps youtube and bluesky source types to their provider", () => {
      expect(providerForSourceType("youtube")).toBe("youtube");
      expect(providerForSourceType("bluesky")).toBe("bluesky");
    });

    it("returns null for rss, podcast, and unknown source types", () => {
      expect(providerForSourceType("rss")).toBeNull();
      expect(providerForSourceType("podcast")).toBeNull();
      expect(providerForSourceType("twitter")).toBeNull();
    });
  });

  describe("persistPermanentSyncFailure()", () => {
    it("persists the error status and message on the feed for a plain ErrorDoNotRetry", async () => {
      await persistPermanentSyncFailure(
        1,
        42,
        new ErrorDoNotRetry("Feed unreachable"),
      );

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          syncStatus: "error",
          syncError: "Feed unreachable",
          syncFailedAt: expect.any(Date),
        }),
      );
    });

    it("does not touch integrations for a feed-only failure (not IntegrationAuthError)", async () => {
      await persistPermanentSyncFailure(
        1,
        42,
        new ErrorDoNotRetry("Source mismatch for feed 42"),
      );

      // Only one update call — the feed. No integration lookup/update, even
      // though this is a permanent failure: a source mismatch or exhausted
      // retries says nothing about whether the connected account is broken.
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("also persists the error status on the backing integration for an IntegrationAuthError", async () => {
      await persistPermanentSyncFailure(
        1,
        42,
        new IntegrationAuthError("youtube", "Re-connect your YouTube account."),
      );

      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdateSet).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          syncStatus: "error",
          syncError: "Re-connect your YouTube account.",
          syncFailedAt: expect.any(Date),
        }),
      );
    });

    it("uses the provider carried on the IntegrationAuthError, not the source type", async () => {
      await persistPermanentSyncFailure(
        1,
        42,
        new IntegrationAuthError("bluesky", "Reconnect Bluesky in Settings."),
      );

      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it("IntegrationAuthError is an instance of ErrorDoNotRetry", () => {
      const error = new IntegrationAuthError("youtube", "expired");
      expect(error).toBeInstanceOf(ErrorDoNotRetry);
    });
  });

  describe("persistSyncSuccess()", () => {
    it("clears the feed's failure state and sets lastFetched", async () => {
      const syncedAt = new Date("2024-06-01T00:00:00Z");
      await persistSyncSuccess(1, 42, "rss", syncedAt);

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          lastFetched: syncedAt,
          syncStatus: "ok",
          syncError: null,
          syncFailedAt: null,
        }),
      );
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("also clears the backing integration's failure state for youtube", async () => {
      const syncedAt = new Date("2024-06-01T00:00:00Z");
      await persistSyncSuccess(1, 42, "youtube", syncedAt);

      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdateSet).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          syncStatus: "ok",
          syncError: null,
          syncFailedAt: null,
        }),
      );
    });
  });
});
