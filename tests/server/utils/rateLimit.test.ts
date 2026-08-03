import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  resolveRateLimit,
  RATE_LIMIT_WINDOW_MS,
  SENSITIVE_RATE_LIMIT,
  DEFAULT_RATE_LIMIT,
  MAX_TRACKED_KEYS,
  type RateLimitStore,
} from "../../../server/utils/rateLimit";

const KEY = "default:user:1";
const START = 1_000_000;

describe("checkRateLimit", () => {
  let store: RateLimitStore;

  beforeEach(() => {
    store = new Map();
  });

  it("allows the first request and opens a window", () => {
    const result = checkRateLimit(store, KEY, 3, START);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetAt).toBe(START + RATE_LIMIT_WINDOW_MS);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("counts requests down to the limit within the same window", () => {
    checkRateLimit(store, KEY, 3, START);
    checkRateLimit(store, KEY, 3, START + 10);
    const third = checkRateLimit(store, KEY, 3, START + 20);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("rejects the request that exceeds the limit", () => {
    checkRateLimit(store, KEY, 2, START);
    checkRateLimit(store, KEY, 2, START + 1);
    const rejected = checkRateLimit(store, KEY, 2, START + 2);
    expect(rejected.allowed).toBe(false);
    expect(rejected.remaining).toBe(0);
    expect(rejected.retryAfterSeconds).toBe(
      Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    );
  });

  it("does not increment the count once the limit is exceeded", () => {
    checkRateLimit(store, KEY, 1, START);
    checkRateLimit(store, KEY, 1, START + 1);
    const rejected = checkRateLimit(store, KEY, 1, START + 2);
    // resetAt stays anchored to the original window, not pushed forward by the
    // rejected hits — a blocked flood can't extend its own penalty box.
    expect(rejected.resetAt).toBe(START + RATE_LIMIT_WINDOW_MS);
  });

  it("starts a fresh window once the old one has elapsed", () => {
    checkRateLimit(store, KEY, 1, START);
    const blocked = checkRateLimit(store, KEY, 1, START + 1);
    expect(blocked.allowed).toBe(false);

    const afterReset = checkRateLimit(
      store,
      KEY,
      1,
      START + RATE_LIMIT_WINDOW_MS,
    );
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });

  it("tracks separate keys independently", () => {
    checkRateLimit(store, "a", 1, START);
    const other = checkRateLimit(store, "b", 1, START);
    expect(other.allowed).toBe(true);
  });

  it("computes retryAfterSeconds as whole seconds remaining in the window", () => {
    checkRateLimit(store, KEY, 1, START);
    const rejected = checkRateLimit(store, KEY, 1, START + 30_500);
    // 60s window opened at START, 30.5s elapsed → 29.5s left → ceil to 30.
    expect(rejected.retryAfterSeconds).toBe(30);
  });

  it("prunes expired windows once the key cap is reached", () => {
    for (let index = 0; index < MAX_TRACKED_KEYS; index += 1) {
      checkRateLimit(store, `stale:${index}`, 1, START);
    }
    expect(store.size).toBe(MAX_TRACKED_KEYS);
    // A brand-new key after the windows have expired triggers the prune, so the
    // store shouldn't keep growing past the cap.
    checkRateLimit(store, "fresh", 1, START + RATE_LIMIT_WINDOW_MS + 1);
    expect(store.size).toBe(1);
  });
});

describe("resolveRateLimit", () => {
  it("returns null for non-API paths", () => {
    expect(resolveRateLimit("/dashboard")).toBeNull();
    expect(resolveRateLimit("/")).toBeNull();
  });

  it("exempts the Stripe webhook from rate limiting", () => {
    expect(resolveRateLimit("/api/billing/webhook")).toBeNull();
  });

  it("applies the sensitive tier to the Bluesky auth endpoint", () => {
    expect(resolveRateLimit("/api/auth/bluesky")).toEqual({
      tier: "sensitive",
      limit: SENSITIVE_RATE_LIMIT,
    });
  });

  it("applies the sensitive tier to billing checkout", () => {
    expect(resolveRateLimit("/api/billing/checkout")).toEqual({
      tier: "sensitive",
      limit: SENSITIVE_RATE_LIMIT,
    });
  });

  it("applies the sensitive tier to nested OAuth callback paths", () => {
    expect(resolveRateLimit("/api/auth/youtube/callback")).toEqual({
      tier: "sensitive",
      limit: SENSITIVE_RATE_LIMIT,
    });
  });

  it("applies the default tier to ordinary API routes", () => {
    expect(resolveRateLimit("/api/search")).toEqual({
      tier: "default",
      limit: DEFAULT_RATE_LIMIT,
    });
    expect(resolveRateLimit("/api/feeds")).toEqual({
      tier: "default",
      limit: DEFAULT_RATE_LIMIT,
    });
  });

  it("keeps the sensitive tier stricter than the default tier", () => {
    expect(SENSITIVE_RATE_LIMIT).toBeLessThan(DEFAULT_RATE_LIMIT);
  });
});
