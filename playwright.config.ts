import { defineConfig, devices } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env" });
loadDotenv({ path: ".env.e2e", override: true });

// @clerk/testing requires standard CLERK_* names; map from Nuxt conventions
if (!process.env.CLERK_SECRET_KEY && process.env.NUXT_CLERK_SECRET_KEY) {
  process.env.CLERK_SECRET_KEY = process.env.NUXT_CLERK_SECRET_KEY;
}
if (
  !process.env.CLERK_PUBLISHABLE_KEY &&
  process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY
) {
  process.env.CLERK_PUBLISHABLE_KEY =
    process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Mock server intercepts outbound OAuth API calls from the Nuxt server process.
// Must match the port used in e2e/mock-server.ts.
const MOCK_PORT = process.env.E2E_MOCK_SERVER_PORT ?? "3099";
const MOCK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "e2e/report", open: "never" }], ["list"]],

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    // Runs first (no Clerk session exists yet) to test unauthenticated behavior.
    // Must run before "setup" to avoid Clerk dev FAPI returning a live session
    // to cookieless browser contexts.
    {
      name: "unauthenticated",
      testMatch: /auth-unauth\.spec\.ts/,
    },
    // Runs after unauthenticated tests to create e2e/.auth/user.json
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      dependencies: ["unauthenticated"],
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      teardown: "account",
      // Exclude files that belong exclusively to other projects so they don't
      // run twice with the wrong auth state.
      testIgnore: [/auth-unauth\.spec\.ts/, /account\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
    // Teardown project — runs after all "chromium" tests. Tests here may sign
    // out (killing the Clerk FAPI session), so nothing else should depend on them.
    {
      name: "account",
      testMatch: /account\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NUXT_DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
      NUXT_CLERK_SECRET_KEY: process.env.NUXT_CLERK_SECRET_KEY ?? "",
      NUXT_GOOGLE_CLIENT_ID: process.env.NUXT_GOOGLE_CLIENT_ID ?? "",
      NUXT_GOOGLE_CLIENT_SECRET: process.env.NUXT_GOOGLE_CLIENT_SECRET ?? "",
      // Route outbound Google API calls to the local mock server so e2e tests
      // never hit the real Google APIs.
      GOOGLE_TOKEN_URL: `${MOCK_BASE_URL}/token`,
      YOUTUBE_CHANNELS_URL: `${MOCK_BASE_URL}/youtube/v3/channels?part=snippet&mine=true`,
      // Route outbound Instagram API calls to the local mock server so e2e tests
      // never hit the real Instagram/Facebook APIs.
      INSTAGRAM_TOKEN_URL: `${MOCK_BASE_URL}/v19.0/oauth/access_token`,
      INSTAGRAM_USER_URL: `${MOCK_BASE_URL}/v19.0/me?fields=id,username&access_token=`,
      // Allow the mock server's loopback address through SSRF validation so
      // feed-discovery e2e tests can use the mock RSS endpoint.
      NUXT_FEED_DISCOVERY_ALLOWED_HOSTS: `127.0.0.1:${MOCK_PORT}`,
      // Route feed-validation fetches through the mock server so no real HTTP
      // requests are made when adding a feed URL during e2e tests.
      FEED_FETCH_PROXY_URL: `${MOCK_BASE_URL}/feed-proxy`,
    },
    stdout: "pipe",
    stderr: "pipe",
  },
});
