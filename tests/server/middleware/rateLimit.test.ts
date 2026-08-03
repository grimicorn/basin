import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  rateLimitStore,
  SENSITIVE_RATE_LIMIT,
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
} from "../../../server/utils/rateLimit";

const mockGetRequestURL = vi.fn();
const mockGetRequestIP = vi.fn();
const mockSetHeader = vi.fn();
vi.stubGlobal("getRequestURL", mockGetRequestURL);
vi.stubGlobal("getRequestIP", mockGetRequestIP);
vi.stubGlobal("setHeader", mockSetHeader);

import rateLimitMiddleware from "../../../server/middleware/rateLimit";

function makeEvent(userId: number | null = null) {
  return {
    context: userId == null ? {} : { user: { id: userId } },
  };
}

function setPath(path: string) {
  mockGetRequestURL.mockReturnValue(new URL(`https://basin.test${path}`));
}

function headerValue(name: string): string | undefined {
  const call = mockSetHeader.mock.calls.find(
    ([, headerName]) => headerName === name,
  );
  return call?.[2];
}

describe("server/middleware/rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitStore.clear();
    mockGetRequestIP.mockReturnValue("203.0.113.5");
  });

  it("ignores non-API paths without touching the store", () => {
    setPath("/dashboard");
    rateLimitMiddleware(makeEvent());
    expect(mockSetHeader).not.toHaveBeenCalled();
    expect(rateLimitStore.size).toBe(0);
  });

  it("skips the exempt Stripe webhook", () => {
    setPath("/api/billing/webhook");
    rateLimitMiddleware(makeEvent());
    expect(mockSetHeader).not.toHaveBeenCalled();
    expect(rateLimitStore.size).toBe(0);
  });

  it("sets rate-limit headers on an allowed default-tier request", () => {
    setPath("/api/search");
    rateLimitMiddleware(makeEvent(1));
    expect(headerValue("X-RateLimit-Limit")).toBe(String(DEFAULT_RATE_LIMIT));
    expect(headerValue("X-RateLimit-Remaining")).toBe(
      String(DEFAULT_RATE_LIMIT - 1),
    );
    expect(headerValue("X-RateLimit-Reset")).toBeDefined();
  });

  it("throws 429 once a sensitive endpoint exceeds its limit", () => {
    setPath("/api/auth/bluesky");
    const event = makeEvent(1);
    for (let attempt = 0; attempt < SENSITIVE_RATE_LIMIT; attempt += 1) {
      expect(() => rateLimitMiddleware(event)).not.toThrow();
    }
    expect(() => rateLimitMiddleware(event)).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    );
  });

  it("sets a Retry-After header when it rejects", () => {
    setPath("/api/auth/bluesky");
    const event = makeEvent(1);
    for (let attempt = 0; attempt < SENSITIVE_RATE_LIMIT; attempt += 1) {
      rateLimitMiddleware(event);
    }
    try {
      rateLimitMiddleware(event);
    } catch {
      // Expected — assert on the header the rejection set.
    }
    expect(headerValue("Retry-After")).toBeDefined();
  });

  it("blocks a sensitive endpoint exactly at its (stricter) limit", () => {
    // A checkout route silently demoted to the default tier is the regression
    // this guards, so assert it rejects on request SENSITIVE_RATE_LIMIT + 1 —
    // not merely "somewhere before the default limit".
    setPath("/api/billing/checkout");
    const event = makeEvent(1);
    let attemptsBeforeThrow = 0;
    for (let attempt = 0; attempt < DEFAULT_RATE_LIMIT; attempt += 1) {
      try {
        rateLimitMiddleware(event);
        attemptsBeforeThrow += 1;
      } catch {
        break;
      }
    }
    expect(attemptsBeforeThrow).toBe(SENSITIVE_RATE_LIMIT);
  });

  it("releases a blocked client after the window elapses", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      setPath("/api/auth/bluesky");
      const event = makeEvent(1);
      for (let attempt = 0; attempt < SENSITIVE_RATE_LIMIT; attempt += 1) {
        rateLimitMiddleware(event);
      }
      expect(() => rateLimitMiddleware(event)).toThrowError(
        expect.objectContaining({ statusCode: 429 }),
      );

      // Advance past the window; the next request opens a fresh one.
      vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS);
      mockSetHeader.mockClear();
      expect(() => rateLimitMiddleware(event)).not.toThrow();
      expect(headerValue("X-RateLimit-Remaining")).toBe(
        String(SENSITIVE_RATE_LIMIT - 1),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps sensitive and default tiers in separate buckets for one user", () => {
    const userId = 7;
    // Exhaust the sensitive tier.
    setPath("/api/auth/bluesky");
    const sensitiveEvent = makeEvent(userId);
    for (let attempt = 0; attempt <= SENSITIVE_RATE_LIMIT; attempt += 1) {
      try {
        rateLimitMiddleware(sensitiveEvent);
      } catch {
        // Ignore the final rejection.
      }
    }
    // A default-tier route for the same user is still allowed.
    setPath("/api/search");
    expect(() => rateLimitMiddleware(makeEvent(userId))).not.toThrow();
  });

  it("keeps different users in separate buckets", () => {
    setPath("/api/auth/bluesky");
    for (let attempt = 0; attempt <= SENSITIVE_RATE_LIMIT; attempt += 1) {
      try {
        rateLimitMiddleware(makeEvent(1));
      } catch {
        // Ignore user 1's rejection.
      }
    }
    expect(() => rateLimitMiddleware(makeEvent(2))).not.toThrow();
  });

  it("falls back to client IP when the request is unauthenticated", () => {
    setPath("/api/auth/youtube/callback");
    mockGetRequestIP.mockReturnValue("198.51.100.9");
    rateLimitMiddleware(makeEvent());
    expect(mockGetRequestIP).toHaveBeenCalled();
    expect(rateLimitStore.has(`sensitive:ip:198.51.100.9`)).toBe(true);
  });
});
