import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { $fetchWithTimeout, FetchTimeoutError } from "~/utils/fetchWithTimeout";

const TIMEOUT_MS = 1000;

describe("$fetchWithTimeout", () => {
  beforeEach(() => {
    vi.mocked(globalThis.$fetch).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the response when the request settles before the timeout", async () => {
    vi.mocked(globalThis.$fetch).mockResolvedValue({ queued: 3 });

    await expect(
      $fetchWithTimeout("/api/feed-sync", { method: "POST" }, TIMEOUT_MS),
    ).resolves.toEqual({ queued: 3 });
  });

  it("forwards the request options and an abort signal to $fetch", async () => {
    vi.mocked(globalThis.$fetch).mockResolvedValue({ queued: 1 });

    await $fetchWithTimeout(
      "/api/feed-sync",
      { method: "POST", headers: { Authorization: "Bearer t" } },
      TIMEOUT_MS,
    );

    expect(globalThis.$fetch).toHaveBeenCalledWith(
      "/api/feed-sync",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer t" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("rejects with a FetchTimeoutError when the request never settles", async () => {
    vi.useFakeTimers();
    vi.mocked(globalThis.$fetch).mockImplementation(
      () => new Promise(() => {}),
    );

    const pending = $fetchWithTimeout(
      "/api/feed-sync",
      { method: "POST" },
      TIMEOUT_MS,
    );
    const rejection = expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await rejection;
  });

  it("aborts the in-flight request signal when the timeout fires", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(globalThis.$fetch).mockImplementation(
      (_request: unknown, options: { signal?: AbortSignal }) => {
        capturedSignal = options.signal;
        return new Promise(() => {});
      },
    );

    const pending = $fetchWithTimeout(
      "/api/feed-sync",
      { method: "POST" },
      TIMEOUT_MS,
    );
    pending.catch(() => {});

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("clears the timeout so a resolved request never gets aborted late", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(globalThis.$fetch).mockImplementation(
      (_request: unknown, options: { signal?: AbortSignal }) => {
        capturedSignal = options.signal;
        return Promise.resolve({ queued: 1 });
      },
    );

    await $fetchWithTimeout("/api/feed-sync", { method: "POST" }, TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 2);

    expect(capturedSignal?.aborted).toBe(false);
  });
});
