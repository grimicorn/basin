import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetOrCreateStripeCustomerId, mockCreateCheckoutSession } =
  vi.hoisted(() => ({
    mockGetOrCreateStripeCustomerId: vi.fn(),
    mockCreateCheckoutSession: vi.fn(),
  }));
vi.mock("../../../../server/utils/subscriptions", () => ({
  getOrCreateStripeCustomerId: mockGetOrCreateStripeCustomerId,
}));
vi.mock("../../../../server/utils/stripe", () => ({
  createCheckoutSession: mockCreateCheckoutSession,
}));

const mockGetRequestURL = vi.fn();
vi.stubGlobal("getRequestURL", mockGetRequestURL);

import handler from "../../../../server/api/billing/checkout.post";

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetRequestURL.mockReturnValue(
      new URL("https://example.com/api/billing/checkout"),
    );
    mockGetOrCreateStripeCustomerId.mockResolvedValue("cus_123");
    mockCreateCheckoutSession.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });
  });

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null }, body: { interval: "month" } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 for a missing interval", async () => {
    const event = { context: { user: { id: 1 } }, body: {} };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid interval", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { interval: "week" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns the checkout session URL", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { interval: "year" },
    };
    const result = await handler(event);
    expect(result).toEqual({ url: "https://checkout.stripe.com/session_123" });
  });

  it("passes the authenticated user's id and requested interval through", async () => {
    const event = {
      context: { user: { id: 42 } },
      body: { interval: "month" },
    };
    await handler(event);
    expect(mockGetOrCreateStripeCustomerId).toHaveBeenCalledWith(42, null);
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cus_123",
        interval: "month",
        userId: 42,
      }),
    );
  });

  it("builds success/cancel URLs from the request origin", async () => {
    mockGetRequestURL.mockReturnValue(
      new URL("https://myapp.com/api/billing/checkout"),
    );
    const event = {
      context: { user: { id: 1 } },
      body: { interval: "year" },
    };
    await handler(event);
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://myapp.com/settings/account?checkout=success",
        cancelUrl: "https://myapp.com/pricing?checkout=cancelled",
      }),
    );
  });

  it("never forwards a client-supplied email to the customer lookup", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { interval: "year", email: "attacker@evil.com" },
    };
    await handler(event);
    expect(mockGetOrCreateStripeCustomerId).toHaveBeenCalledWith(1, null);
  });

  it("throws 502 when Stripe does not return a session URL", async () => {
    mockCreateCheckoutSession.mockResolvedValue({ url: null });
    const event = {
      context: { user: { id: 1 } },
      body: { interval: "year" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 502 });
  });
});
