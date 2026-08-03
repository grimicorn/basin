import type { H3Event } from "h3";
import {
  checkRateLimit,
  rateLimitStore,
  resolveRateLimit,
  MILLISECONDS_PER_SECOND,
  type RateLimitPolicy,
  type RateLimitResult,
} from "../utils/rateLimit";

// Shared fallback bucket for requests we can't attribute to a user or an IP.
// Grouping them keeps an unidentifiable flood from getting a free pass.
const UNKNOWN_CLIENT = "unknown";

const HTTP_TOO_MANY_REQUESTS = 429;

// Runs after server/middleware/auth.ts (Nitro orders middleware by filename,
// and "auth" < "rateLimit"), so event.context.user is already resolved and we
// can key authenticated traffic by user id instead of a shared IP.
export default defineEventHandler((event) => {
  const { pathname } = getRequestURL(event);
  const policy = resolveRateLimit(pathname);
  if (!policy) {
    return;
  }

  const key = buildRateLimitKey(event, policy);
  const result = checkRateLimit(rateLimitStore, key, policy.limit, Date.now());
  applyRateLimitHeaders(event, result);

  if (result.allowed) {
    return;
  }

  setHeader(event, "Retry-After", String(result.retryAfterSeconds));
  throw createError({
    statusCode: HTTP_TOO_MANY_REQUESTS,
    statusMessage: "Too many requests, please slow down and try again shortly",
  });
});

// Separate bucket per (tier, identity): normal browsing on the default tier
// can't drain a user's sensitive-tier budget, and vice versa.
function buildRateLimitKey(event: H3Event, policy: RateLimitPolicy): string {
  const userId = event.context.user?.id;
  if (userId != null) {
    return `${policy.tier}:user:${userId}`;
  }
  return `${policy.tier}:ip:${resolveClientIp(event)}`;
}

// Netlify sets x-nf-client-connection-ip to the real edge-observed client IP
// and strips any client-supplied copy, so it can't be spoofed. Prefer it over
// h3's X-Forwarded-For resolution, which trusts a header the client controls —
// without this, an attacker rotating X-Forwarded-For would mint a fresh bucket
// per request and walk straight past the sensitive tier. Fall back to h3 only
// when the trusted header is absent (local dev / non-Netlify hosts).
function resolveClientIp(event: H3Event): string {
  const trustedIp = getHeader(event, "x-nf-client-connection-ip");
  if (trustedIp) {
    return trustedIp;
  }
  return getRequestIP(event, { xForwardedFor: true }) ?? UNKNOWN_CLIENT;
}

function applyRateLimitHeaders(event: H3Event, result: RateLimitResult): void {
  setHeader(event, "X-RateLimit-Limit", String(result.limit));
  setHeader(event, "X-RateLimit-Remaining", String(result.remaining));
  setHeader(
    event,
    "X-RateLimit-Reset",
    String(Math.ceil(result.resetAt / MILLISECONDS_PER_SECOND)),
  );
}
