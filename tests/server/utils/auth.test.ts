import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

const runtimeConfig = { disableSignups: "" };

vi.stubGlobal("useDb", () => ({
  query: { users: { findFirst: mockFindFirst } },
  insert: mockInsert,
}));
vi.stubGlobal("useRuntimeConfig", () => runtimeConfig);

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
    runtimeConfig.disableSignups = "";
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

  describe("when sign-ups are disabled", () => {
    beforeEach(() => {
      runtimeConfig.disableSignups = "true";
    });

    it("still returns an existing user", async () => {
      mockFindFirst.mockResolvedValue(mockUser);

      const result = await getOrCreateUser("clerk_abc");

      expect(result).toEqual(mockUser);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("rejects a new user with a 403 instead of creating one", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      await expect(getOrCreateUser("clerk_new")).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
