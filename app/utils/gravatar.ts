import { md5 } from "./md5";

const GRAVATAR_BASE = "https://www.gravatar.com/avatar";

/**
 * Normalize an email address for Gravatar: lowercase and trim whitespace.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Build a Gravatar URL for the given email address.
 *
 * @param email - The user's email address.
 * @param size  - Desired image size in pixels (default 80).
 *
 * Uses `d=404` so Gravatar returns a 404 when no avatar exists,
 * allowing callers to detect the absence and fall back to initials.
 */
export function gravatarUrl(email: string, size = 80): string {
  const hash = md5(normalizeEmail(email));
  return `${GRAVATAR_BASE}/${hash}?d=404&s=${size}`;
}
