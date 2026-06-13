import * as Sentry from "@sentry/nuxt";

Sentry.init({
  // The DSN is read from the SENTRY_DSN environment variable at runtime.
  // Set SENTRY_DSN in your Netlify environment variables (or .env locally).
  dsn: process.env.SENTRY_DSN,

  // Capture 10 % of traces in production; use 100 % locally for development.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
