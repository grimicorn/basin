import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAccountPlan } = vi.hoisted(() => ({
  mockGetAccountPlan: vi.fn(),
}));
vi.mock("../../../../server/utils/subscriptions", () => ({
  getAccountPlan: mockGetAccountPlan,
}));

import handler from "../../../../server/api/billing/plan.get";

describe("GET /api/billing/plan", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
    expect(mockGetAccountPlan).not.toHaveBeenCalled();
  });

  it("returns the account plan for the authenticated user", async () => {
    const plan = {
      plan: "pro",
      status: "trialing",
      trialEnd: "2026-01-15T00:00:00.000Z",
      currentPeriodEnd: "2026-02-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    };
    mockGetAccountPlan.mockResolvedValue(plan);
    const event = { context: { user: { id: 7 } } };
    const result = await handler(event);
    expect(mockGetAccountPlan).toHaveBeenCalledWith(7);
    expect(result).toEqual(plan);
  });
});
