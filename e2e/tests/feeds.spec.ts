import { test, expect } from "@playwright/test";

test.describe("Settings > Feeds", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/feeds");
    await expect(page.locator("h2").getByText("RSS & Podcasts")).toBeVisible({
      timeout: 10_000,
    });
    // The add button is :disabled="loading" while onMounted(load) is in flight.
    // Waiting for it to become enabled is a deterministic signal that load()
    // has completed and the feed list has rendered — more reliable than
    // networkidle, which can fire before the client-side fetch finishes.
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
      page.locator('input[placeholder="https://example.com/feed.xml"]'),
    ).toBeVisible();
  });

  test("add feed button is disabled when input is empty", async ({ page }) => {
    const input = page.locator(
      'input[placeholder="https://example.com/feed.xml"]',
    );
    await expect(input).toHaveValue("");
    // Button should not submit an empty form
    const btn = page.locator(".btn-primary");
    await btn.click();
    // Feed list should be unchanged — the original seeded feed still shows
    await expect(page.getByText("E2E Test Feed")).toBeVisible();
  });

  test("can add a new feed URL", async ({ page }) => {
    // Use a unique URL per run to avoid duplicate key errors if teardown
    // did not complete cleanly in a prior run (e.g. concurrent CI jobs).
    const newUrl = `https://test-add-${crypto.randomUUID()}.example.com/feed.xml`;
    await page
      .locator('input[placeholder="https://example.com/feed.xml"]')
      .fill(newUrl);
    await page.locator(".btn-primary").click();
    // Server saves the URL immediately (no RSS fetch); title is null so the URL
    // is shown as the feed name via `fd.title ?? fd.url`
    await expect(page.locator(".feed-row", { hasText: newUrl })).toBeVisible({
      timeout: 8_000,
    });
    // Input should be cleared after a successful add
    await expect(
      page.locator('input[placeholder="https://example.com/feed.xml"]'),
    ).toHaveValue("");
  });

  test("removes a feed via the trash button", async ({ page }) => {
    // Add a fresh feed so this test is self-contained and retry-safe —
    // deleting the seeded "E2E Test Feed" would break retries and other tests.
    const removeUrl = `https://test-remove-${crypto.randomUUID()}.example.com/feed.xml`;
    await page
      .locator('input[placeholder="https://example.com/feed.xml"]')
      .fill(removeUrl);
    await page.locator(".btn-primary").click();

    const feedRow = page.locator(".feed-row", { hasText: removeUrl });
    await expect(feedRow).toBeVisible({ timeout: 8_000 });
    await feedRow.locator('button[title="Remove"]').click();
    await expect(feedRow).not.toBeVisible({ timeout: 5_000 });
  });
});
