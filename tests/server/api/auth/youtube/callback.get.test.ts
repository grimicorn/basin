import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetQuery = vi.fn();
const mockGetCookie = vi.fn();
const mockDeleteCookie = vi.fn();
const mockGetRequestURL = vi.fn();
const mockSendRedirect = vi.fn();
const mockExchangeCodeForTokens = vi.fn();
const mockGetYouTubeChannelHandle = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

vi.stubGlobal("getQuery", mockGetQuery);
vi.stubGlobal("getCookie", mockGetCookie);
vi.stubGlobal("deleteCookie", mockDeleteCookie);
vi.stubGlobal("getRequestURL", mockGetRequestURL);
vi.stubGlobal("sendRedirect", mockSendRedirect);
vi.stubGlobal("exchangeCodeForTokens", mockExchangeCodeForTokens);
vi.stubGlobal("getYouTubeChannelHandle", mockGetYouTubeChannelHandle);
vi.stubGlobal("useDb", () => ({ insert: mockInsert }));

import handler from "../../../../../server/api/auth/youtube/callback.get";

const mockTokens = {
  access_token: "access-abc",
  refresh_token: "refresh-xyz",
  expires_in: 3600,
  scope:
    "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile",
  token_type: "Bearer",
};

describe("GET /api/auth/youtube/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
    mockSendRedirect.mockResolvedValue(undefined);
    mockGetRequestURL.mockReturnValue(
      new URL("https://example.com/api/auth/youtube/callback"),
    );
    mockGetYouTubeChannelHandle.mockResolvedValue("@testchannel");
    mockExchangeCodeForTokens.mockResolvedValue(mockTokens);
  });

  it("throws 401 when not authenticated", async () => {
    const event = { context: { user: null } };
    mockGetQuery.mockReturnValue({ code: "abc", state: "state123" });
    mockGetCookie.mockReturnValue("state123");
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when state param is missing", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "abc" });
    mockGetCookie.mockReturnValue("state123");
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when code is missing", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ state: "state123" });
    mockGetCookie.mockReturnValue("state123");
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when state does not match cookie", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "abc", state: "bad-state" });
    mockGetCookie.mockReturnValue("state123");
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("deletes the oauth_state cookie on a valid flow", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    mockGetCookie.mockReturnValue("state123");
    await handler(event);
    expect(mockDeleteCookie).toHaveBeenCalledWith(event, "oauth_state");
  });

  it("exchanges the code and inserts the integration", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    mockGetCookie.mockReturnValue("state123");
    await handler(event);
    expect(mockExchangeCodeForTokens).toHaveBeenCalledWith(
      "auth-code",
      "https://example.com/api/auth/youtube/callback",
    );
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        provider: "youtube",
        accessToken: "access-abc",
        providerUsername: "@testchannel",
      }),
    );
  });

  it("stores scopes split by space", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    mockGetCookie.mockReturnValue("state123");
    await handler(event);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: [
          "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/userinfo.profile",
        ],
      }),
    );
  });

  it("redirects to /settings on success", async () => {
    const event = { context: { user: { id: 1 } } };
    mockGetQuery.mockReturnValue({ code: "auth-code", state: "state123" });
    mockGetCookie.mockReturnValue("state123");
    await handler(event);
    expect(mockSendRedirect).toHaveBeenCalledWith(
      event,
      "/settings/connections",
    );
  });
});
