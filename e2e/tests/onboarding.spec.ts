import { test, expect } from "@playwright/test";
import { MOCK_BASE_URL } from "../mock-server";

// Route-intercept the feeds and integrations APIs to simulate an empty account.
// This avoids modifying the shared database while still exercising the onboarding UI.
async function mockEmptyAccount(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
) {
  await page.route("**/api/feeds", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    }
    return route.continue();
  });
  await page.route("**/api/integrations", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    }
    return route.continue();
  });
}

test.describe("Dashboard onboarding (empty account)", () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyAccount(page);
    await page.goto("/dashboard");
    await expect(page.getByText("Your Feed", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    // Wait until the onboarding hero renders — this confirms useFeeds().load() has
    // completed and Vue has determined there are no feeds.
    await expect(
      page.getByText("Your feed is empty — let's fill it."),
    ).toBeVisible({ timeout: 15_000 });
    // Wait for all in-flight API calls (feeds + integrations) to settle so
    // connLoading is false and Connect buttons are enabled before tests click them.
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
  });

  test("shows the onboarding hero", async ({ page }) => {
    await expect(
      page.getByText("Your feed is empty — let's fill it."),
    ).toBeVisible();
  });

  test("shows the 'no sources yet' subtitle", async ({ page }) => {
    await expect(page.locator(".page-sub")).toContainText("no sources yet");
  });

  test("shows the RSS add card", async ({ page }) => {
    await expect(page.locator(".ob-card")).toBeVisible();
  });

  test("feed input is present", async ({ page }) => {
    await expect(
      page.locator(
        `input[placeholder="https://example.com or https://example.com/feed.xml"]`,
      ),
    ).toBeVisible();
  });

  test("shows the connection grid", async ({ page }) => {
    await expect(page.locator(".ob-grid")).toBeVisible();
  });

  test("YouTube connection card is shown", async ({ page }) => {
    await expect(page.locator(".ob-src", { hasText: "YouTube" })).toBeVisible();
  });

  test("Bluesky connection card is shown", async ({ page }) => {
    await expect(page.locator(".ob-src", { hasText: "Bluesky" })).toBeVisible();
  });

  test("shows the getting-started steps", async ({ page }) => {
    await expect(page.locator(".ob-steps")).toBeVisible();
    await expect(page.locator(".ob-step.active")).toContainText("Add a source");
  });

  test("can add a feed URL via the onboarding form", async ({ page }) => {
    // Allow POST /api/feeds/discover and POST /api/feeds to pass through so the
    // real server handles them. The mock only routes GET /api/feeds to return [].
    const newUrl = `${MOCK_BASE_URL}/feed.xml`;
    await page
      .locator(
        `input[placeholder="https://example.com or https://example.com/feed.xml"]`,
      )
      .fill(newUrl);
    await page.locator(".ob-add-btn").click();

    // After a successful add, the onboarding hides and the feed view appears.
    // Because the dashboard uses mock store data for the feed display we just
    // confirm the onboarding hero is gone.
    await expect(
      page.getByText("Your feed is empty — let's fill it."),
    ).not.toBeVisible({ timeout: 10_000 });
  });

  // Serial so the disconnect test can follow the connect test deterministically.
  test.describe.serial("YouTube OAuth flow from onboarding", () => {
    test("can connect YouTube via OAuth from onboarding", async ({ page }) => {
      const FAKE_STATE = "e2e_fake_oauth_state_onboarding_12345";

      await page.context().addCookies([
        {
          name: "oauth_state_youtube",
          value: FAKE_STATE,
          url: "http://localhost:3000",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      // After the OAuth flow, integrations reload — return YouTube as connected.
      // This overrides the mockEmptyAccount handler (Playwright uses LIFO order).
      await page.route("**/api/integrations", (route) => {
        if (route.request().method() === "GET") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                id: 1,
                provider: "youtube",
                providerUsername: "@testchannel",
                createdAt: new Date().toISOString(),
              },
            ]),
          });
        }
        return route.continue();
      });

      // Intercept the OAuth initiation — return HTML that JS-redirects to the callback.
      await page.route(
        "**/api/auth/youtube",
        async (route) => {
          const callbackUrl = `http://localhost:3000/api/auth/youtube/callback?code=mock_code&state=${FAKE_STATE}`;
          await route.fulfill({
            status: 200,
            contentType: "text/html",
            body:
              `<script>location.replace(${JSON.stringify(callbackUrl)})</` +
              `script>`,
          });
        },
        { times: 1 },
      );

      // Intercept the callback — skip the real Google token exchange and redirect
      // straight to /dashboard.
      await page.route(
        "**/api/auth/youtube/callback**",
        async (route) => {
          await route.fulfill({
            status: 302,
            headers: { Location: "/dashboard" },
            body: "",
          });
        },
        { times: 1 },
      );

      const ytCard = page.locator(".ob-src", { hasText: "YouTube" });
      await ytCard.locator(".btn-primary").click();

      // Wait for the dashboard to reload after the OAuth callback redirect.
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 20_000 });

      // After connecting, the YouTube card should show as connected.
      await expect(
        page.locator(".ob-src", { hasText: "YouTube" }).locator(".live"),
      ).toBeVisible({ timeout: 8_000 });
    });
  });

  test.describe("Bluesky form in onboarding", () => {
    test("clicking Connect on Bluesky shows the inline form", async ({
      page,
    }) => {
      const bsCard = page.locator(".ob-src", { hasText: "Bluesky" });
      await bsCard.locator("button.connect").click();
      await expect(page.locator(".bluesky-form")).toBeVisible();
    });

    test("Cancel hides the Bluesky form", async ({ page }) => {
      const bsCard = page.locator(".ob-src", { hasText: "Bluesky" });
      await bsCard.locator("button.connect").click();
      await expect(page.locator(".bluesky-form")).toBeVisible();
      await page.locator(".bluesky-actions .btn:last-child").click();
      await expect(page.locator(".bluesky-form")).not.toBeVisible();
    });

    test("can connect Bluesky with handle and app password", async ({
      page,
    }) => {
      // Mock POST /api/auth/bluesky so the test never calls the real Bluesky API.
      await page.route("**/api/auth/bluesky", (route) => {
        if (route.request().method() === "POST") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              handle: "e2etestuser.bsky.social",
            }),
          });
        }
        return route.continue();
      });

      // After the POST, useConnections.load() re-fetches integrations.
      // Return Bluesky as connected so the .live indicator appears.
      await page.route("**/api/integrations", (route) => {
        if (route.request().method() === "GET") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                id: 2,
                provider: "bluesky",
                providerUsername: "e2etestuser.bsky.social",
                createdAt: new Date().toISOString(),
              },
            ]),
          });
        }
        return route.continue();
      });

      const bsCard = page.locator(".ob-src", { hasText: "Bluesky" });
      await bsCard.locator("button.connect").click();

      await page.locator("#ob-bsky-handle").fill("e2etestuser.bsky.social");
      await page.locator("#ob-bsky-password").fill("abcd-efgh-ijkl-mnop");
      await page.locator(".bluesky-actions .btn-primary").click();

      // On success the form hides.
      await expect(page.locator(".bluesky-form")).not.toBeVisible({
        timeout: 8_000,
      });
      // The Bluesky card should now show as connected.
      await expect(
        page.locator(".ob-src", { hasText: "Bluesky" }).locator(".live"),
      ).toBeVisible({ timeout: 8_000 });
    });
  });
});
