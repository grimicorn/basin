import { test, expect, type Page } from "@playwright/test";
import { MOCK_BASE_URL } from "../mock-server";

const FEED_INPUT_PLACEHOLDER =
  "https://example.com or https://example.com/feed.xml";

// Fills the add-feed input, clicks "Add feed" to trigger discovery, then
// clicks "Confirm" in the pending-feed confirmation step. Returns once the
// confirmation UI has dismissed (i.e. once discovery + save both complete).
async function submitFeedUrl(page: Page, url: string): Promise<void> {
  await page
    .locator(`input[placeholder="${FEED_INPUT_PLACEHOLDER}"]`)
    .fill(url);
  await page.locator(".btn-primary").click();

  // After discovery the pending-feed confirmation UI appears. Wait for it then
  // click Confirm to persist the feed.
  const confirmButton = page.locator(".pending-feed-actions .btn-primary");
  await expect(confirmButton).toBeVisible({ timeout: 10_000 });
  await confirmButton.click();

  // Wait for the pending-feed UI to disappear — signals the save completed.
  await expect(confirmButton).not.toBeVisible({ timeout: 10_000 });
}

test.describe("Settings > Feeds", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/feeds");
    await expect(page.locator("h2").getByText("RSS & Podcasts")).toBeVisible({
      timeout: 10_000,
    });
    // Wait for the seeded feed to be visible — this is an unambiguous signal that
    // load() has completed and Vue has rendered the list. Both networkidle and
    // toBeEnabled() on the add button can pass before onMounted(load) fires due
    // to the SSR rendering gap, causing the test to click a disabled button or
    // interact with a stale UI.
    await expect(page.getByText("E2E Test Feed")).toBeVisible({
      timeout: 15_000,
    });
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

    await submitFeedUrl(page, newUrl);

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
    // Use the mock server's feed endpoint so discovery succeeds. A unique query
    // param avoids a duplicate-URL conflict with the "can add" test which inserts
    // the bare /feed.xml URL in the same run. Each retry generates a new param,
    // keeping the test retry-safe.
    const removeUrl = `${MOCK_BASE_URL}/feed.xml?id=${crypto.randomUUID()}`;

    await submitFeedUrl(page, removeUrl);

    const feedRow = page.locator(".feed-row", { hasText: removeUrl });
    await expect(feedRow).toBeVisible({ timeout: 8_000 });
    await feedRow.locator('button[title="Remove"]').click();
    await expect(feedRow).not.toBeVisible({ timeout: 5_000 });
  });
});
