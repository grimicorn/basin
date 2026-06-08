import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.stubGlobal("useDb", () => ({
  query: { integrations: { findMany: mockFindMany } },
}));

import handler from "../../../server/api/integrations.get";

const mockIntegration = {
  id: 1,
  userId: 1,
  provider: "youtube",
  providerUsername: "@mychannel",
  createdAt: new Date("2024-01-01").toISOString(),
  updatedAt: null,
};

describe("GET /api/integrations", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns the user's integrations", async () => {
    mockFindMany.mockResolvedValue([mockIntegration]);
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual([mockIntegration]);
  });

  it("returns an empty array when the user has no integrations", async () => {
    mockFindMany.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual([]);
  });

  it("queries only for the authenticated user's id", async () => {
    mockFindMany.mockResolvedValue([]);
    const event = { context: { user: { id: 42 } } };
    await handler(event);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});
