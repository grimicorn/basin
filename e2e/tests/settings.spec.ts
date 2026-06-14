import { test, expect, type Page } from "@playwright/test";

// Register the PATCH waiter BEFORE clicking so the response is never missed.
function waitForSettingSave(page: Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/settings/reading") &&
      resp.request().method() === "PATCH",
    { timeout: 5_000 },
  );
}

async function reloadAndWait(page: Page) {
  await page.reload();
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
}

async function testTogglePersists(page: Page, rowLabel: string) {
  const toggle = page
    .locator(".set-pref-row")
    .filter({ hasText: rowLabel })
    .locator(".toggle");

  const wasBefore = await toggle.evaluate((el) => el.classList.contains("on"));
  const save = waitForSettingSave(page);
  await toggle.click();
  await save;

  await reloadAndWait(page);
  if (wasBefore) {
    await expect(toggle).not.toHaveClass(/on/);
  } else {
    await expect(toggle).toHaveClass(/on/);
  }
}

test.describe("Settings > Reading", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/reading");
    await expect(
      page.locator("h2").getByText("Reading preferences"),
    ).toBeVisible({ timeout: 10_000 });
    // Wait for Vue to hydrate and for initAppearance() to finish loading
    // settings from the DB before any test interactions.
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("theme: switching to dark persists across reload", async ({ page }) => {
    const themeRow = page.locator(".set-pref-row").filter({ hasText: "Theme" });
    const save = waitForSettingSave(page);
    await themeRow.locator("button", { hasText: "Dark" }).click();
    await save;

    await reloadAndWait(page);
    await expect(themeRow.locator("button", { hasText: "Dark" })).toHaveClass(
      /active/,
    );
  });

  test("accent color: switching to blue persists across reload", async ({
    page,
  }) => {
    const accentRow = page
      .locator(".set-pref-row")
      .filter({ hasText: "Accent color" });
    const save = waitForSettingSave(page);
    await accentRow.locator('.twk-sw[title="blue"]').click();
    await save;

    await reloadAndWait(page);
    await expect(accentRow.locator('.twk-sw[title="blue"]')).toHaveClass(/on/);
  });

  test("reading font: switching to serif persists across reload", async ({
    page,
  }) => {
    const fontRow = page
      .locator(".set-pref-row")
      .filter({ hasText: "Reading font" });
    const serifBtn = fontRow.locator("button", { hasText: "Serif" });

    // If serif is already active from a prior CI run, switch to mono first so
    // the serif click below is always a real state change that triggers a PATCH.
    // Without this guard a no-op click starves waitForSettingSave and times out.
    if (await serifBtn.evaluate((el) => el.classList.contains("active"))) {
      const reset = waitForSettingSave(page);
      await fontRow.locator("button", { hasText: "Mono" }).click();
      await reset;
    }

    const save = waitForSettingSave(page);
    await serifBtn.click();
    await save;

    await reloadAndWait(page);
    await expect(serifBtn).toHaveClass(/active/);
  });

  test("spacing: switching to compact persists across reload", async ({
    page,
  }) => {
    const spacingRow = page
      .locator(".set-pref-row")
      .filter({ hasText: "Spacing" });
    const save = waitForSettingSave(page);
    await spacingRow.locator("button", { hasText: "Compact" }).click();
    await save;

    await reloadAndWait(page);
    await expect(
      spacingRow.locator("button", { hasText: "Compact" }),
    ).toHaveClass(/active/);
  });

  test("show unread only: toggling persists across reload", async ({
    page,
  }) => {
    await testTogglePersists(page, "Show unread only");
  });

  test("autoplay media previews: toggling persists across reload", async ({
    page,
  }) => {
    await testTogglePersists(page, "Autoplay media previews");
  });

  test("compact notifications: toggling persists across reload", async ({
    page,
  }) => {
    await testTogglePersists(page, "Compact notifications");
  });

  test("default layout: switching to grid persists across reload", async ({
    page,
  }) => {
    const layoutRow = page
      .locator(".set-pref-row")
      .filter({ hasText: "Default layout" });
    const save = waitForSettingSave(page);
    await layoutRow.locator("button", { hasText: "Grid" }).click();
    await save;

    await reloadAndWait(page);
    await expect(layoutRow.locator("button", { hasText: "Grid" })).toHaveClass(
      /active/,
    );
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
