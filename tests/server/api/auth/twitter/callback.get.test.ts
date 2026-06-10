import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetQuery = vi.fn();
const mockGetCookie = vi.fn();
const mockDeleteCookie = vi.fn();
const mockGetRequestURL = vi.fn();
const mockSendRedirect = vi.fn();
const mockExchangeTwitterCodeForTokens = vi.fn();
const mockGetTwitterUserInfo = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

vi.stubGlobal("getQuery", mockGetQuery);
vi.stubGlobal("getCookie", mockGetCookie);
vi.stubGlobal("deleteCookie", mockDeleteCookie);
vi.stubGlobal("getRequestURL", mockGetRequestURL);
vi.stubGlobal("sendRedirect", mockSendRedirect);
vi.stubGlobal("exchangeTwitterCodeForTokens", mockExchangeTwitterCodeForTokens);
vi.stubGlobal("getTwitterUserInfo", mockGetTwitterUserInfo);
vi.stubGlobal("useDb", () => ({ insert: mockInsert }));

import handler from "../../../../../server/api/auth/twitter/callback.get";

const mockTokens = {
  access_token: "access-abc",
  refresh_token: "refresh-xyz",
  expires_in: 7200,
  scope: "tweet.read users.read follows.read offline.access",
  token_type: "bearer",
};

describe("GET /api/auth/twitter/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
    mockSendRedirect.mockResolvedValue(undefined);
    mockGetRequestURL.mockReturnValue(
      new URL("https://example.com/api/auth/twitter/callback"),
    );
    mockGetTwitterUserInfo.mockResolvedValue({
      userId: "99999",
      username: "@twitteruser",
    });
    mockExchangeTwitterCodeForTokens.mockResolvedValue(mockTokens);
    mockGetCookie.mockImplementation((_event: unknown, name: string) => {
      if (name === "oauth_state") return "state123";
      if (name === "twitter_code_verifier") return "verifier-abc";
      return null;
    });
  });

  it("throws 401 when not authenticated", async () => {
    const event = { context: { user: null } };
    mockGetQuery.mockReturnValue({ code: "abc", state: "state123" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when state param is missing", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "abc" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when code is missing", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ state: "state123" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when state does not match cookie", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "abc", state: "bad-state" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when code verifier cookie is missing", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    mockGetCookie.mockImplementation((_event: unknown, name: string) => {
      if (name === "oauth_state") return "state123";
      return null;
    });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("deletes the oauth_state cookie on a valid flow", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    await handler(event);
    expect(mockDeleteCookie).toHaveBeenCalledWith(event, "oauth_state");
  });

  it("deletes the twitter_code_verifier cookie on a valid flow", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    await handler(event);
    expect(mockDeleteCookie).toHaveBeenCalledWith(
      event,
      "twitter_code_verifier",
    );
  });

  it("exchanges the code with the code verifier and inserts the integration", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    await handler(event);
    expect(mockExchangeTwitterCodeForTokens).toHaveBeenCalledWith(
      "auth-code",
      "https://example.com/api/auth/twitter/callback",
      "verifier-abc",
    );
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        provider: "twitter",
        accessToken: "access-abc",
        providerUsername: "@twitteruser",
        providerAccountId: "99999",
      }),
    );
  });

  it("stores scopes split by space", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: ["tweet.read", "users.read", "follows.read", "offline.access"],
      }),
    );
  });

  it("sets expiresAt when expires_in is present", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    const before = Date.now();
    await handler(event);
    const after = Date.now();
    const callArgs = mockValues.mock.calls[0][0];
    expect(callArgs.expiresAt).toBeInstanceOf(Date);
    const expiresMs = callArgs.expiresAt.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 7200 * 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 7200 * 1000);
  });

  it("sets expiresAt to null when expires_in is absent", async () => {
    const tokensWithoutExpiry = {
      access_token: "access-abc",
      scope: "tweet.read users.read",
      token_type: "bearer",
    };
    mockExchangeTwitterCodeForTokens.mockResolvedValue(tokensWithoutExpiry);
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });

  it("redirects to /settings/connections on success", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    await handler(event);
    expect(mockSendRedirect).toHaveBeenCalledWith(
      event,
      "/settings/connections",
    );
  });
});
