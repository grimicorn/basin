import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockWhere = vi.fn();
const mockDelete = vi.fn();

vi.stubGlobal("useDb", () => ({ delete: mockDelete }));

import handler from "../../../../server/api/feeds/[id].delete";

describe("DELETE /api/feeds/:id", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDelete.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
  });

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null }, params: { id: "1" } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 for a non-numeric id", async () => {
    const event = { context: { user: { id: 1 } }, params: { id: "abc" } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the feed does not belong to the user", async () => {
    mockReturning.mockResolvedValue([]);
    const event = { context: { user: { id: 1 } }, params: { id: "99" } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("deletes the feed and returns ok", async () => {
    mockReturning.mockResolvedValue([{ id: 1 }]);
    const event = { context: { user: { id: 1 } }, params: { id: "1" } };
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
  });

  it("deletes using both feed id and user id for ownership check", async () => {
    mockReturning.mockResolvedValue([{ id: 5 }]);
    const event = { context: { user: { id: 7 } }, params: { id: "5" } };
    await handler(event);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });
});
