import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyWebhookSignature, mockUpsertSubscriptionFromStripe } =
  vi.hoisted(() => ({
    mockVerifyWebhookSignature: vi.fn(),
    mockUpsertSubscriptionFromStripe: vi.fn(),
  }));
vi.mock("../../../../server/utils/stripe", () => ({
  verifyWebhookSignature: mockVerifyWebhookSignature,
}));
vi.mock("../../../../server/utils/subscriptions", () => ({
  upsertSubscriptionFromStripe: mockUpsertSubscriptionFromStripe,
}));

const mockGetHeader = vi.fn();
const mockReadRawBody = vi.fn();
vi.stubGlobal("getHeader", mockGetHeader);
vi.stubGlobal("readRawBody", mockReadRawBody);

import handler from "../../../../server/api/billing/webhook.post";

const RAW_BODY = '{"id":"evt_123"}';
const SIGNATURE = "t=1,v1=abc";

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetHeader.mockReturnValue(SIGNATURE);
    mockReadRawBody.mockResolvedValue(RAW_BODY);
  });

  it("throws 400 when the Stripe-Signature header is missing", async () => {
    mockGetHeader.mockReturnValue(undefined);
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    expect(mockVerifyWebhookSignature).not.toHaveBeenCalled();
  });

  it("throws 400 when the request body is empty", async () => {
    mockReadRawBody.mockResolvedValue(undefined);
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    expect(mockVerifyWebhookSignature).not.toHaveBeenCalled();
  });

  it("throws 400 when signature verification fails, without leaking the SDK error", async () => {
    mockVerifyWebhookSignature.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const error = await handler({}).catch((caught: Error) => caught);
    expect(error).toMatchObject({ statusCode: 400 });
    expect(error.message).toBe("Invalid Stripe webhook signature");
  });

  it("propagates a 5xx from verifyWebhookSignature instead of masking it as a bad signature", async () => {
    // A missing NUXT_STRIPE_WEBHOOK_SECRET surfaces as a 500 createError from
    // verifyWebhookSignature; that's a server misconfiguration, not a bad
    // signature, so it must not be reported to Stripe as a 400 (Stripe won't
    // retry a 400, but will retry a 5xx once the secret is fixed).
    mockVerifyWebhookSignature.mockImplementation(() => {
      throw globalThis.createError({
        statusCode: 500,
        statusMessage:
          "Stripe is not configured: missing NUXT_STRIPE_WEBHOOK_SECRET",
      });
    });
    const error = await handler({}).catch((caught: Error) => caught);
    expect(error).toMatchObject({ statusCode: 500 });
    expect(error.message).toBe(
      "Stripe is not configured: missing NUXT_STRIPE_WEBHOOK_SECRET",
    );
  });

  it("verifies the signature using the raw body and header", async () => {
    mockVerifyWebhookSignature.mockReturnValue({
      type: "invoice.paid",
      data: { object: {} },
    });
    await handler({});
    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
      RAW_BODY,
      SIGNATURE,
    );
  });

  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ])("persists subscription state for %s", async (type) => {
    const subscription = { id: "sub_123" };
    mockVerifyWebhookSignature.mockReturnValue({
      type,
      data: { object: subscription },
    });
    await handler({});
    expect(mockUpsertSubscriptionFromStripe).toHaveBeenCalledWith(subscription);
  });

  it("ignores event types it doesn't handle", async () => {
    mockVerifyWebhookSignature.mockReturnValue({
      type: "invoice.paid",
      data: { object: {} },
    });
    await handler({});
    expect(mockUpsertSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it("returns { received: true } on success", async () => {
    mockVerifyWebhookSignature.mockReturnValue({
      type: "invoice.paid",
      data: { object: {} },
    });
    const result = await handler({});
    expect(result).toEqual({ received: true });
  });
});
