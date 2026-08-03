// Fixed-window rate limiting for API routes, isolated here as a pure seam so
// the counting logic and the route→tier classification can be unit-tested
// without an HTTP layer. server/middleware/rateLimit.ts is the only production
// caller; it owns the shared store and the request/identity plumbing.
//
// SERVERLESS TRADEOFF (read before trusting these numbers): the store is an
// in-process Map. On Netlify each function instance keeps its own counters, so
// the effective ceiling scales with the number of warm instances, and a cold
// start wipes the window entirely. This is deliberately best-effort — it blunts
// a single hot instance being used for credential stuffing against
// /api/auth/bluesky or checkout-session spam against /api/billing/checkout
// without adding infrastructure. A hard, global guarantee needs a shared store
// (e.g. Redis/Upstash); basin's infra has none today, so this documents the
// weaker per-instance guarantee rather than pretending to a strong one.

// One rolling window for every tier. Kept as one value (not per-tier) so the
// limits below read as "N requests per minute" against a single, obvious unit.
export const RATE_LIMIT_WINDOW_MS = 60_000;

// Sensitive auth/billing endpoints: live Bluesky auth (credential-stuffing
// vector), Stripe Checkout session creation (real cost per call), and OAuth
// callbacks. Tight ceiling — far above what a real user's UI triggers, far
// below what an attacker needs.
export const SENSITIVE_RATE_LIMIT = 10;

// Everything else under /api. Generous enough that normal dashboard usage
// (feed lists, search, settings) never trips it.
export const DEFAULT_RATE_LIMIT = 100;

// Cap on distinct keys held in a single instance's store. Above this we prune
// expired windows on insert so a long-lived warm instance can't grow the Map
// without bound. Purely a memory guard; it never rejects a live request.
export const MAX_TRACKED_KEYS = 10_000;

export type RateLimitTier = "sensitive" | "default";

export interface RateLimitPolicy {
  tier: RateLimitTier;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export type RateLimitStore = Map<string, RateLimitWindow>;

// The production store. Exported so the middleware can share one instance;
// tests always pass their own Map so they never touch this shared state.
export const rateLimitStore: RateLimitStore = new Map();

// Route prefixes that get the sensitive tier. Prefix-matched so nested paths
// (…/youtube/callback) inherit their parent's tier automatically.
const SENSITIVE_ROUTE_PREFIXES = [
  "/api/auth/bluesky",
  "/api/auth/youtube",
  "/api/billing/checkout",
];

// Machine-to-machine endpoints that must never be rate limited: Stripe
// delivers webhooks from its own IP pool and retries aggressively, and the
// handler already verifies the Stripe signature. Throttling it would silently
// drop legitimate billing events.
const RATE_LIMIT_EXEMPT_PREFIXES = ["/api/billing/webhook"];

function hasPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

// Returns the policy to apply, or null when the path is not a rate-limited API
// route (non-/api paths and exempt endpoints).
export function resolveRateLimit(path: string): RateLimitPolicy | null {
  if (!path.startsWith("/api/")) {
    return null;
  }
  if (hasPrefix(path, RATE_LIMIT_EXEMPT_PREFIXES)) {
    return null;
  }
  if (hasPrefix(path, SENSITIVE_ROUTE_PREFIXES)) {
    return { tier: "sensitive", limit: SENSITIVE_RATE_LIMIT };
  }
  return { tier: "default", limit: DEFAULT_RATE_LIMIT };
}

function pruneExpired(store: RateLimitStore, now: number): void {
  for (const [key, window] of store) {
    if (now >= window.resetAt) {
      store.delete(key);
    }
  }
}

function startWindow(
  store: RateLimitStore,
  key: string,
  limit: number,
  now: number,
  windowMs: number,
): RateLimitResult {
  if (store.size >= MAX_TRACKED_KEYS) {
    pruneExpired(store, now);
  }
  const resetAt = now + windowMs;
  store.set(key, { count: 1, resetAt });
  return {
    allowed: true,
    limit,
    remaining: limit - 1,
    resetAt,
    retryAfterSeconds: 0,
  };
}

function rejectRequest(
  limit: number,
  now: number,
  resetAt: number,
): RateLimitResult {
  return {
    allowed: false,
    limit,
    remaining: 0,
    resetAt,
    retryAfterSeconds: Math.ceil((resetAt - now) / 1000),
  };
}

// Records one request against `key` and reports whether it is allowed. Callers
// pass `now` (and their own store) so the function stays pure and deterministic
// under test.
export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  now: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): RateLimitResult {
  const existing = store.get(key);
  if (!existing || now >= existing.resetAt) {
    return startWindow(store, key, limit, now, windowMs);
  }
  if (existing.count >= limit) {
    return rejectRequest(limit, now, existing.resetAt);
  }
  existing.count += 1;
  return {
    allowed: true,
    limit,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}
