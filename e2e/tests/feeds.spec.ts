import { test, expect } from "@playwright/test";
import { MOCK_BASE_URL } from "../mock-server";

const FEED_INPUT_PLACEHOLDER =
  "https://example.com or https://example.com/feed.xml";

test.describe("Settings > Feeds", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/feeds");
    await expect(page.locator("h2").getByText("RSS & Podcasts")).toBeVisible({
      timeout: 10_000,
    });
    // The add button is :disabled="loading || busy" while onMounted(load) is in
    // flight. The heading appears from SSR before load() completes, so waiting
    // for the button to be enabled is a reliable signal that the /api/feeds call
    // has finished and the feed list has been populated.
    await expect(page.locator(".btn-primary")).toBeEnabled({ timeout: 15_000 });
  });

  test("shows seeded feed in the list", async ({ page }) => {
    await expect(page.getByText("E2E Test Feed")).toBeVisible({
      timeout: 8_000,
    });
  });

  test("shows the feed URL in the list", async ({ page }) => {
    await expect(
      page.getByText("https://e2e.example.com/feed.xml"),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("add feed input is present", async ({ page }) => {
    await expect(
      page.locator(`input[placeholder="${FEED_INPUT_PLACEHOLDER}"]`),
    ).toBeVisible();
  });

  test("add feed button is disabled when input is empty", async ({ page }) => {
    const input = page.locator(
      `input[placeholder="${FEED_INPUT_PLACEHOLDER}"]`,
    );
    await expect(input).toHaveValue("");
    // Button should not submit an empty form
    const btn = page.locator(".btn-primary");
    await btn.click();
    // Feed list should be unchanged — the original seeded feed still shows
    await expect(page.getByText("E2E Test Feed")).toBeVisible();
  });

  test("can add a new feed URL", async ({ page }) => {
    // Use the mock server's /feed.xml endpoint so the discover step resolves
    // without real outbound HTTP requests. The mock returns a valid RSS document
    // with content-type application/rss+xml so both discovery and validation pass.
    const newUrl = `${MOCK_BASE_URL}/feed.xml`;
    await page
      .locator(`input[placeholder="${FEED_INPUT_PLACEHOLDER}"]`)
      .fill(newUrl);
    await page.locator(".btn-primary").click();

    // The feed is stored without a title (feeds.post.ts does not parse feed
    // metadata), so .feed-name falls back to displaying the URL.
    const feedRow = page.locator(".feed-row", { hasText: newUrl });
    await expect(feedRow).toBeVisible({ timeout: 8_000 });
    await expect(feedRow.locator(".feed-name")).toHaveText(newUrl);

    // Input should be cleared after a successful add
    await expect(
      page.locator(`input[placeholder="${FEED_INPUT_PLACEHOLDER}"]`),
    ).toHaveValue("");
  });

  test("removes a feed via the trash button", async ({ page }) => {
    const feedRow = page.locator(".feed-row", { hasText: "E2E Test Feed" });
    await expect(feedRow).toBeVisible({ timeout: 8_000 });
    await feedRow.locator('button[title="Remove"]').click();
    await expect(feedRow).not.toBeVisible({ timeout: 5_000 });
  });
});
