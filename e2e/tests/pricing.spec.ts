import { test, expect } from "@playwright/test";

// We never want e2e runs to hit real Stripe or complete a real payment, so
// this intercepts the checkout request the browser makes and returns a URL
// on our own origin — enough to prove the CTA initiates checkout (and that
// the browser follows the redirect) without any Stripe credentials.
test.describe("Pricing → Stripe checkout", () => {
  test("clicking the Pro CTA starts checkout and redirects to the returned URL", async ({
    page,
  }) => {
    await page.route("**/api/billing/checkout", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.interval).toBe("year");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "http://localhost:3000/dashboard?mock_checkout=1",
        }),
      });
    });

    await page.goto("/pricing");
    // .plan.featured is static SSR markup, so waiting for it alone doesn't
    // guarantee Vue has hydrated and attached the CTA's click listener yet —
    // clicking too early is a silent no-op (this page renders inside a
    // <Suspense> boundary, so hydration resolves asynchronously after the
    // initial paint). Wait for the network to settle first so the click
    // lands on a fully interactive button.
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".plan.featured")).toBeVisible();

    await page.locator(".plan.featured button.btn-primary").click();

    await expect(page).toHaveURL(/mock_checkout=1/, { timeout: 10_000 });
  });
});
