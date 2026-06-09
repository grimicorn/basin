import { test, expect } from "@playwright/test";

test.describe("Settings > Reading", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/reading");
    await expect(
      page.locator("h2").getByText("Reading preferences"),
    ).toBeVisible({ timeout: 10_000 });
    // The heading is SSR-rendered; wait for Vue to hydrate before clicking
    // seg buttons. initAppearance() is client-only so handlers aren't
    // attached until after the JS bundles load and execute.
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("theme toggle buttons are visible", async ({ page }) => {
    const themeRow = page.locator(".set-pref-row").filter({ hasText: "Theme" });
    await expect(themeRow.locator(".seg")).toBeVisible();
    await expect(themeRow.locator(".seg button")).toHaveCount(3);
  });

  test("can switch theme to dark", async ({ page }) => {
    const themeRow = page.locator(".set-pref-row").filter({ hasText: "Theme" });
    await themeRow.locator(".seg button", { hasText: "Dark" }).click();
    await expect(
      themeRow.locator(".seg button", { hasText: "Dark" }),
    ).toHaveClass(/active/);
  });

  test("reading font toggle is visible", async ({ page }) => {
    const fontRow = page
      .locator(".set-pref-row")
      .filter({ hasText: "Reading font" });
    await expect(fontRow.locator(".seg")).toBeVisible();
  });

  test("spacing toggle is visible", async ({ page }) => {
    const spacingRow = page
      .locator(".set-pref-row")
      .filter({ hasText: "Spacing" });
    await expect(spacingRow.locator(".seg")).toBeVisible();
  });
});

test.describe("Settings navigation", () => {
  test("/ redirects to /settings/feeds", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/feeds/);
  });

  test("settings sub-pages are reachable", async ({ page }) => {
    for (const path of [
      "/settings/feeds",
      "/settings/connections",
      "/settings/reading",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path));
    }
  });
});
