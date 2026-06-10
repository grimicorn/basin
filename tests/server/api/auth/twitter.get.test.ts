import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetCookie = vi.fn();
const mockGetRequestURL = vi.fn();
const mockSendRedirect = vi.fn();
const mockBuildTwitterAuthUrl = vi.fn(
  () => "https://twitter.com/i/oauth2/authorize?test=1",
);

vi.stubGlobal("setCookie", mockSetCookie);
vi.stubGlobal("getRequestURL", mockGetRequestURL);
vi.stubGlobal("sendRedirect", mockSendRedirect);
vi.stubGlobal("buildTwitterAuthUrl", mockBuildTwitterAuthUrl);

import handler from "../../../../server/api/auth/twitter.get";

describe("GET /api/auth/twitter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetRequestURL.mockReturnValue(
      new URL("https://example.com/api/auth/twitter"),
    );
    mockSendRedirect.mockResolvedValue(undefined);
    mockBuildTwitterAuthUrl.mockReturnValue(
      "https://twitter.com/i/oauth2/authorize?test=1",
    );
  });

  it("throws 401 when not authenticated", async () => {
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("sets the oauth_state cookie as httpOnly with lax sameSite", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockSetCookie).toHaveBeenCalledWith(
      event,
      "oauth_state",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });

  it("sets the oauth_state cookie with a 600s TTL", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockSetCookie).toHaveBeenCalledWith(
      event,
      "oauth_state",
      expect.any(String),
      expect.objectContaining({ maxAge: 600 }),
    );
  });

  it("sets the twitter_code_verifier cookie as httpOnly with lax sameSite", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockSetCookie).toHaveBeenCalledWith(
      event,
      "twitter_code_verifier",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });

  it("sets the twitter_code_verifier cookie with a 600s TTL", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockSetCookie).toHaveBeenCalledWith(
      event,
      "twitter_code_verifier",
      expect.any(String),
      expect.objectContaining({ maxAge: 600 }),
    );
  });

  it("redirects to the URL returned by buildTwitterAuthUrl", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockSendRedirect).toHaveBeenCalledWith(
      event,
      "https://twitter.com/i/oauth2/authorize?test=1",
    );
  });

  it("passes the correct callback redirect_uri to buildTwitterAuthUrl", async () => {
    mockGetRequestURL.mockReturnValue(
      new URL("https://myapp.com/api/auth/twitter"),
    );
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockBuildTwitterAuthUrl).toHaveBeenCalledWith(
      "https://myapp.com/api/auth/twitter/callback",
      expect.any(String),
      expect.any(String),
    );
  });
});
