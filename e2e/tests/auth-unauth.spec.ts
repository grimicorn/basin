import { test, expect } from "@playwright/test";

// These tests run in the "unauthenticated" project, which executes BEFORE
// auth.setup.ts creates a Clerk session. With no active FAPI session,
// the client-side route middleware behaves exactly as it would for a real
// unauthenticated visitor — making these tests reliable in dev mode.
test.describe("Auth guards (unauthenticated)", () => {
  test("visiting /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("visiting / stays on / (public marketing page)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  });
});
