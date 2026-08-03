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
      $fetchWithTimeout("/api/feed-sync", TIMEOUT_MS, { method: "POST" }),
    ).resolves.toEqual({ queued: 3 });
  });

  it("forwards the request options and an abort signal to $fetch", async () => {
    vi.mocked(globalThis.$fetch).mockResolvedValue({ queued: 1 });

    await $fetchWithTimeout("/api/feed-sync", TIMEOUT_MS, {
      method: "POST",
      headers: { Authorization: "Bearer t" },
    });

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

    const pending = $fetchWithTimeout("/api/feed-sync", TIMEOUT_MS, {
      method: "POST",
    });
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

    const pending = $fetchWithTimeout("/api/feed-sync", TIMEOUT_MS, {
      method: "POST",
    });
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

    await $fetchWithTimeout("/api/feed-sync", TIMEOUT_MS, { method: "POST" });
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 2);

    expect(capturedSignal?.aborted).toBe(false);
  });

  it("propagates a non-timeout error unchanged and clears the timeout", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const failure = new Error("network down");
    vi.mocked(globalThis.$fetch).mockImplementation(
      (_request: unknown, options: { signal?: AbortSignal }) => {
        capturedSignal = options.signal;
        return Promise.reject(failure);
      },
    );

    await expect(
      $fetchWithTimeout("/api/feed-sync", TIMEOUT_MS, { method: "POST" }),
    ).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 2);

    expect(capturedSignal?.aborted).toBe(false);
  });

  it("aborts the request when a caller-supplied signal is already aborted", async () => {
    vi.mocked(globalThis.$fetch).mockResolvedValue({ queued: 1 });
    const controller = new AbortController();
    controller.abort();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(globalThis.$fetch).mockImplementation(
      (_request: unknown, options: { signal?: AbortSignal }) => {
        capturedSignal = options.signal;
        return Promise.resolve({ queued: 1 });
      },
    );

    await $fetchWithTimeout("/api/feed-sync", TIMEOUT_MS, {
      method: "POST",
      signal: controller.signal,
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("aborts the request when a caller-supplied signal fires later", async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(globalThis.$fetch).mockImplementation(
      (_request: unknown, options: { signal?: AbortSignal }) => {
        capturedSignal = options.signal;
        return new Promise(() => {});
      },
    );

    const pending = $fetchWithTimeout("/api/feed-sync", TIMEOUT_MS, {
      method: "POST",
      signal: controller.signal,
    });
    pending.catch(() => {});
    controller.abort();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
