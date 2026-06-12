/**
 * Sentry abstraction layer.
 *
 * All code that calls Sentry goes through these functions so the external
 * service is isolated and testable without a real Sentry DSN.
 */

import * as Sentry from "@sentry/nuxt";

export type SentryUser = {
  id: string;
  email?: string;
};

export type SentryExtras = Record<string, unknown>;

/**
 * Capture an exception and send it to Sentry.
 * Accepts optional extras to attach to the event.
 */
export function captureException(
  error: unknown,
  extras?: SentryExtras,
): string {
  return Sentry.withScope((scope) => {
    if (extras) scope.setExtras(extras);
    return Sentry.captureException(error);
  });
}

/**
 * Capture a plain message and send it to Sentry.
 */
export function captureMessage(message: string, extras?: SentryExtras): string {
  return Sentry.withScope((scope) => {
    if (extras) scope.setExtras(extras);
    return Sentry.captureMessage(message);
  });
}

/**
 * Associate the current Sentry scope with an authenticated user.
 * Call this after a user signs in.
 */
export function identifyUser(user: SentryUser): void {
  Sentry.setUser(user);
}

/**
 * Clear the current user from the Sentry scope.
 * Call this when a user signs out.
 */
export function clearUser(): void {
  Sentry.setUser(null);
}
