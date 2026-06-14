import { test, expect } from "@playwright/test";

test.describe("Settings > Connections", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/connections");
    await expect(
      page.locator("h2").getByText("Connected accounts"),
    ).toBeVisible({ timeout: 10_000 });
    // The connect/disconnect buttons are :disabled="loading" while
    // onMounted(load) fetches integrations. Wait for networkidle so the API
    // call finishes (loading → false) before any test clicks a button.
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("shows the connections grid", async ({ page }) => {
    await expect(page.locator(".conn-grid")).toBeVisible();
  });

  test("YouTube connection card is shown", async ({ page }) => {
    await expect(page.locator(".conn", { hasText: "YouTube" })).toBeVisible();
  });

  test("YouTube shows as not connected (no seed integration)", async ({
    page,
  }) => {
    const youtubeCard = page.locator(".conn", { hasText: "YouTube" });
    // No connected indicator since we didn't seed an integration
    await expect(youtubeCard.locator(".live")).not.toBeVisible();
    // Connect button should be the primary style
    await expect(youtubeCard.locator(".btn-primary")).toBeVisible();
  });

  // Serial block so retries replay the connect step before disconnect.
  // Without serial, a disconnect retry runs without the connect having run,
  // which fails deterministically because the integration is absent from the DB.
  test.describe.serial("YouTube OAuth flow", () => {
    test("can connect YouTube via OAuth", async ({ page }) => {
      // Playwright cannot intercept navigation requests to accounts.google.com —
      // Chromium treats that domain specially (HSTS preload / preconnect) and the
      // CDP Fetch intercept never fires. Instead, we short-circuit one layer
      // earlier: intercept /api/auth/youtube before it issues the Google redirect,
      // and inject a known oauth_state_youtube cookie so the real callback can validate it.
      const FAKE_STATE = "e2e_fake_oauth_state_12345";

      await page.context().addCookies([
        {
          name: "oauth_state_youtube",
          value: FAKE_STATE,
          url: "http://localhost:3000",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      await page.route(
        "**/api/auth/youtube",
        async (route) => {
          const callbackUrl = `http://localhost:3000/api/auth/youtube/callback?code=mock_code&state=${FAKE_STATE}`;
          await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: `<script>location.replace(${JSON.stringify(callbackUrl)})</script>`,
          });
        },
        { times: 1 },
      );

      const youtubeCard = page.locator(".conn", { hasText: "YouTube" });

      // Register the response waiter BEFORE clicking — page.click() does not
      // wait for navigation, so any check after click() sees the old URL.
      const callbackDone = page.waitForResponse(
        (resp) => resp.url().includes("/api/auth/youtube/callback"),
        { timeout: 20_000 },
      );
      await youtubeCard.locator(".btn-primary").click();
      await callbackDone;

      // Callback redirected to /settings/connections; wait for the page to fully
      // reload including the integrations API call so .live is rendered.
      await page.waitForLoadState("networkidle", { timeout: 20_000 });

      await expect(youtubeCard.locator(".live")).toBeVisible({
        timeout: 8_000,
      });
      await expect(youtubeCard).toContainText("@e2etestchannel");
    });

    test("can disconnect YouTube", async ({ page }) => {
      const youtubeCard = page.locator(".conn", { hasText: "YouTube" });
      // Integration was created by the previous test and persists in the DB
      await expect(youtubeCard.locator(".live")).toBeVisible({
        timeout: 8_000,
      });

      await youtubeCard.getByRole("button", { name: "Disconnect" }).click();

      await expect(youtubeCard.locator(".live")).not.toBeVisible({
        timeout: 5_000,
      });
      await expect(youtubeCard.locator(".btn-primary")).toBeVisible();
    });
  });

  test("Instagram connection card is shown", async ({ page }) => {
    await expect(page.locator(".conn", { hasText: "Instagram" })).toBeVisible();
  });

  test("Instagram shows as not connected (no seed integration)", async ({
    page,
  }) => {
    const instagramCard = page.locator(".conn", { hasText: "Instagram" });
    // No connected indicator since we didn't seed an integration
    await expect(instagramCard.locator(".live")).not.toBeVisible();
    // Connect button should be the primary style
    await expect(instagramCard.locator(".btn-primary")).toBeVisible();
  });

  // Serial block so retries replay the connect step before disconnect.
  // Without serial, a disconnect retry runs without the connect having run,
  // which fails deterministically because the integration is absent from the DB.
  test.describe.serial("Instagram OAuth flow", () => {
    test("can connect Instagram via OAuth", async ({ page }) => {
      // Playwright cannot intercept navigation requests to facebook.com —
      // Chromium treats that domain specially and the CDP Fetch intercept never
      // fires. Instead, we short-circuit one layer earlier: intercept
      // /api/auth/instagram before it issues the Facebook redirect, and inject a
      // known oauth_state_instagram cookie so the real callback can validate it.
      const FAKE_STATE = "e2e_fake_instagram_oauth_state_12345";

      await page.context().addCookies([
        {
          name: "oauth_state_instagram",
          value: FAKE_STATE,
          url: "http://localhost:3000",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      await page.route(
        "**/api/auth/instagram",
        async (route) => {
          const callbackUrl = `http://localhost:3000/api/auth/instagram/callback?code=mock_code&state=${FAKE_STATE}`;
          await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: `<script>location.replace(${JSON.stringify(callbackUrl)})</script>`,
          });
        },
        { times: 1 },
      );

      const instagramCard = page.locator(".conn", { hasText: "Instagram" });

      // Register the response waiter BEFORE clicking — page.click() does not
      // wait for navigation, so any check after click() sees the old URL.
      const callbackDone = page.waitForResponse(
        (resp) => resp.url().includes("/api/auth/instagram/callback"),
        { timeout: 20_000 },
      );
      await instagramCard.locator(".btn-primary").click();
      await callbackDone;

      // Callback redirected to /settings/connections; wait for the page to fully
      // reload including the integrations API call so .live is rendered.
      await page.waitForLoadState("networkidle", { timeout: 20_000 });

      await expect(instagramCard.locator(".live")).toBeVisible({
        timeout: 8_000,
      });
      await expect(instagramCard).toContainText("e2etestuser");
    });

    test("can disconnect Instagram", async ({ page }) => {
      const instagramCard = page.locator(".conn", { hasText: "Instagram" });
      // Integration was created by the previous test and persists in the DB
      await expect(instagramCard.locator(".live")).toBeVisible({
        timeout: 8_000,
      });

      await instagramCard.getByRole("button", { name: "Disconnect" }).click();

      await expect(instagramCard.locator(".live")).not.toBeVisible({
        timeout: 5_000,
      });
      await expect(instagramCard.locator(".btn-primary")).toBeVisible();
    });
  });
});
