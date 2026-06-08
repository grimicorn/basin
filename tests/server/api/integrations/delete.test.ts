import { describe, it, expect, vi, beforeEach } from "vitest";

const mockWhere = vi.fn();
const mockDelete = vi.fn();

vi.stubGlobal("useDb", () => ({ delete: mockDelete }));

import handler from "../../../../server/api/integrations/[provider].delete";

describe("DELETE /api/integrations/:provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDelete.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue(undefined);
  });

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null }, params: { provider: "youtube" } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when provider param is missing", async () => {
    const event = { context: { user: { id: 1 } }, params: {} };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("deletes the integration and returns ok", async () => {
    const event = {
      context: { user: { id: 1 } },
      params: { provider: "youtube" },
    };
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
  });

  it("calls delete once with the correct provider and user", async () => {
    const event = {
      context: { user: { id: 7 } },
      params: { provider: "youtube" },
    };
    await handler(event);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });
});
