import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Your Feed")).toBeVisible({ timeout: 10_000 });
    // Wait for JS bundles to load and Vue to hydrate. setupWatchers() runs in
    // onMounted (client-only) — clicking seg/fchip buttons before hydration
    // loses the event because handlers aren't attached yet.
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("shows feed items", async ({ page }) => {
    // The dashboard currently renders items from the mock dataset in ~/data/mock.js.
    // Update this assertion when the dashboard is wired to the real backend API.
    await expect(page.getByText("The Quiet Death of the Homepage")).toBeVisible(
      { timeout: 10_000 },
    );
  });

  test("filter chips are visible", async ({ page }) => {
    await expect(page.locator(".fchip").first()).toBeVisible();
  });

  test("unread-only toggle changes displayed items", async ({ page }) => {
    const chip = page.locator(".fchip").first();
    await chip.click();
    // After toggling, the chip becomes active
    await expect(chip).toHaveClass(/active/);
    // Toggle back
    await chip.click();
    await expect(chip).not.toHaveClass(/active/);
  });

  test("can switch layout to grid", async ({ page }) => {
    const feed = page.locator(".feed");
    // Default is timeline
    await expect(feed).toHaveClass(/layout-timeline/);

    // Click the second seg button (grid)
    await page.locator(".seg button").nth(1).click();
    await expect(feed).toHaveClass(/layout-grid/);
  });

  test("can switch layout to columns", async ({ page }) => {
    await page.locator(".seg button").nth(2).click();
    await expect(page.locator(".feed")).toHaveClass(/layout-columns/);
  });
});
