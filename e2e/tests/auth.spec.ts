import { test, expect } from "@playwright/test";

test.describe("Auth guards (authenticated)", () => {
  test("authenticated user is redirected away from /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("authenticated user can reach the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Your Feed", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });
});
