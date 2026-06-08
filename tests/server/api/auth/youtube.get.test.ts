import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetCookie = vi.fn();
const mockGetRequestURL = vi.fn();
const mockSendRedirect = vi.fn();
const mockBuildYouTubeAuthUrl = vi.fn(
  () => "https://accounts.google.com/oauth?test=1",
);

vi.stubGlobal("setCookie", mockSetCookie);
vi.stubGlobal("getRequestURL", mockGetRequestURL);
vi.stubGlobal("sendRedirect", mockSendRedirect);
vi.stubGlobal("buildYouTubeAuthUrl", mockBuildYouTubeAuthUrl);

import handler from "../../../../server/api/auth/youtube.get";

describe("GET /api/auth/youtube", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetRequestURL.mockReturnValue(
      new URL("https://example.com/api/auth/youtube"),
    );
    mockSendRedirect.mockResolvedValue(undefined);
    mockBuildYouTubeAuthUrl.mockReturnValue(
      "https://accounts.google.com/oauth?test=1",
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

  it("redirects to the URL returned by buildYouTubeAuthUrl", async () => {
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockSendRedirect).toHaveBeenCalledWith(
      event,
      "https://accounts.google.com/oauth?test=1",
    );
  });

  it("passes the correct callback redirect_uri to buildYouTubeAuthUrl", async () => {
    mockGetRequestURL.mockReturnValue(
      new URL("https://myapp.com/api/auth/youtube"),
    );
    const event = { context: { user: { id: 1 } } };
    await handler(event);
    expect(mockBuildYouTubeAuthUrl).toHaveBeenCalledWith(
      "https://myapp.com/api/auth/youtube/callback",
      expect.any(String),
    );
  });
});
