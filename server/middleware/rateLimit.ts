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
  const clientIp =
    getRequestIP(event, { xForwardedFor: true }) ?? UNKNOWN_CLIENT;
  return `${policy.tier}:ip:${clientIp}`;
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
