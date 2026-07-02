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
