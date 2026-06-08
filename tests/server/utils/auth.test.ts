import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

vi.stubGlobal("useDb", () => ({
  query: { users: { findFirst: mockFindFirst } },
  insert: mockInsert,
}));

import { getOrCreateUser } from "../../../server/utils/auth";

const mockUser = {
  id: 1,
  providerId: "clerk_abc",
  createdAt: null,
  updatedAt: null,
};

describe("getOrCreateUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
  });

  it("returns the existing user when found by providerId", async () => {
    mockFindFirst.mockResolvedValue(mockUser);

    const result = await getOrCreateUser("clerk_abc");

    expect(result).toEqual(mockUser);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates and returns a new user when none exists", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    mockReturning.mockResolvedValue([mockUser]);

    const result = await getOrCreateUser("clerk_abc");

    expect(result).toEqual(mockUser);
  });

  it("inserts with the correct providerId when creating", async () => {
    const newUser = { ...mockUser, id: 2, providerId: "clerk_xyz" };
    mockFindFirst.mockResolvedValue(undefined);
    mockReturning.mockResolvedValue([newUser]);

    await getOrCreateUser("clerk_xyz");

    expect(mockValues).toHaveBeenCalledWith({ providerId: "clerk_xyz" });
  });
});
