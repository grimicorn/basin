import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubGlobal("useRuntimeConfig", () => ({
  twitterClientId: "test-twitter-client-id",
  twitterClientSecret: "test-twitter-client-secret",
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  buildTwitterAuthUrl,
  exchangeTwitterCodeForTokens,
  getTwitterUserInfo,
} from "../../../server/utils/twitter";

describe("buildTwitterAuthUrl", () => {
  it("returns a Twitter authorization URL", () => {
    const url = buildTwitterAuthUrl(
      "https://example.com/callback",
      "state123",
      "verifier123",
    );
    expect(url).toContain("twitter.com/i/oauth2/authorize");
  });

  it("includes client_id, redirect_uri, and state", () => {
    const url = buildTwitterAuthUrl(
      "https://example.com/callback",
      "state123",
      "verifier123",
    );
    expect(url).toContain("client_id=test-twitter-client-id");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=state123");
  });

  it("includes the code challenge and plain method", () => {
    const url = buildTwitterAuthUrl(
      "https://example.com/callback",
      "state123",
      "verifier123",
    );
    expect(url).toContain("code_challenge=verifier123");
    expect(url).toContain("code_challenge_method=plain");
  });

  it("requests tweet.read, users.read, follows.read, and offline.access scopes", () => {
    const url = buildTwitterAuthUrl(
      "https://example.com/callback",
      "state123",
      "verifier123",
    );
    expect(url).toContain("tweet.read");
    expect(url).toContain("users.read");
    expect(url).toContain("follows.read");
    expect(url).toContain("offline.access");
  });
});

describe("exchangeTwitterCodeForTokens", () => {
  beforeEach(() => vi.resetAllMocks());

  it("posts to the Twitter token endpoint and returns parsed JSON", async () => {
    const tokenData = {
      access_token: "access-123",
      refresh_token: "refresh-456",
      expires_in: 7200,
      scope: "tweet.read users.read follows.read offline.access",
      token_type: "bearer",
    };
    mockFetch.mockResolvedValue({ json: () => Promise.resolve(tokenData) });

    const result = await exchangeTwitterCodeForTokens(
      "auth-code",
      "https://example.com/callback",
      "verifier123",
    );
    expect(result).toEqual(tokenData);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.twitter.com/2/oauth2/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends the authorization code and code verifier in the form body", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });
    await exchangeTwitterCodeForTokens(
      "my-code",
      "https://example.com/cb",
      "my-verifier",
    );
    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain("code=my-code");
    expect(body).toContain("code_verifier=my-verifier");
    expect(body).toContain("grant_type=authorization_code");
  });

  it("sends Basic auth header with base64-encoded client credentials", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });
    await exchangeTwitterCodeForTokens("code", "https://example.com/cb", "v");
    const headers = mockFetch.mock.calls[0][1].headers;
    const expectedCredentials = Buffer.from(
      "test-twitter-client-id:test-twitter-client-secret",
    ).toString("base64");
    expect(headers.Authorization).toBe(`Basic ${expectedCredentials}`);
  });
});

describe("getTwitterUserInfo", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the username prefixed with @ and the userId", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          data: { id: "123456", username: "testuser" },
        }),
    });
    const info = await getTwitterUserInfo("access-token");
    expect(info.username).toBe("@testuser");
    expect(info.userId).toBe("123456");
  });

  it("returns empty strings when data is absent", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({}),
    });
    const info = await getTwitterUserInfo("access-token");
    expect(info.username).toBe("");
    expect(info.userId).toBe("");
  });

  it("calls the Twitter users/me endpoint with a Bearer token", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: { id: "1", username: "u" } }),
    });
    await getTwitterUserInfo("my-token");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("twitter.com/2/users/me"),
      expect.objectContaining({
        headers: { Authorization: "Bearer my-token" },
      }),
    );
  });
});
