import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadBody = vi.fn();
const mockCreateBlueskySession = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.stubGlobal("readBody", mockReadBody);
vi.stubGlobal("createBlueskySession", mockCreateBlueskySession);
vi.stubGlobal("useDb", () => ({ insert: mockInsert, update: mockUpdate }));

import handler from "../../../../server/api/auth/bluesky.post";

const mockSession = {
  did: "did:plc:abc123",
  handle: "you.bsky.social",
  accessJwt: "access-jwt-token",
  refreshJwt: "refresh-jwt-token",
};

describe("POST /api/auth/bluesky", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockCreateBlueskySession.mockResolvedValue(mockSession);
    mockReadBody.mockResolvedValue({
      handle: "you.bsky.social",
      appPassword: "xxxx-xxxx-xxxx-xxxx",
    });
  });

  it("throws 401 when not authenticated", async () => {
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when handle is missing", async () => {
    mockReadBody.mockResolvedValue({ appPassword: "xxxx-xxxx-xxxx-xxxx" });
    const event = { context: { user: { id: 1 } } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when app password is missing", async () => {
    mockReadBody.mockResolvedValue({ handle: "you.bsky.social" });
    const event = { context: { user: { id: 1 } } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body is empty", async () => {
    mockReadBody.mockResolvedValue({});
    const event = { context: { user: { id: 1 } } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("calls createBlueskySession with the provided handle and app password", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockCreateBlueskySession).toHaveBeenCalledWith(
      "you.bsky.social",
      "xxxx-xxxx-xxxx-xxxx",
    );
  });

  it("inserts the integration with the correct provider and user", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        provider: "bluesky",
        accessToken: "access-jwt-token",
        refreshToken: "refresh-jwt-token",
        providerAccountId: "did:plc:abc123",
        providerUsername: "you.bsky.social",
      }),
    );
  });

  it("returns ok and the Bluesky handle on success", async () => {
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual({ ok: true, handle: "you.bsky.social" });
  });

  it("trims whitespace from handle and app password", async () => {
    mockReadBody.mockResolvedValue({
      handle: "  you.bsky.social  ",
      appPassword: "  xxxx-xxxx-xxxx-xxxx  ",
    });
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockCreateBlueskySession).toHaveBeenCalledWith(
      "you.bsky.social",
      "xxxx-xxxx-xxxx-xxxx",
    );
  });

  it("clears any previously-recorded sync failure on the integration on (re)connect", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          syncStatus: "ok",
          syncError: null,
          syncFailedAt: null,
        }),
      }),
    );
  });

  it("also clears any previously-recorded sync failure on the user's Bluesky feeds", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        syncStatus: "ok",
        syncError: null,
        syncFailedAt: null,
      }),
    );
  });
});
