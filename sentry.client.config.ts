import * as Sentry from "@sentry/nuxt";

Sentry.init({
  // The DSN is read from the SENTRY_DSN environment variable at runtime.
  // Set SENTRY_DSN in your Netlify environment variables (or .env locally).
  dsn: import.meta.env.SENTRY_DSN,

  // Capture 10 % of traces in production; use 100 % locally for development.
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

  // Replay captures sessions on error at 100 % and 10 % of healthy sessions.
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],
});
