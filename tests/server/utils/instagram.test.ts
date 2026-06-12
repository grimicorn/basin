import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubGlobal("useRuntimeConfig", () => ({
  instagramClientId: "test-instagram-client-id",
  instagramClientSecret: "test-instagram-client-secret",
}));

import {
  buildInstagramAuthUrl,
  exchangeInstagramCode,
  getInstagramUsername,
} from "../../../server/utils/instagram";

describe("buildInstagramAuthUrl", () => {
  it("returns a Facebook OAuth dialog URL", () => {
    const url = buildInstagramAuthUrl(
      "https://example.com/callback",
      "state123",
    );
    expect(url).toContain("facebook.com/v19.0/dialog/oauth");
  });

  it("includes client_id, redirect_uri, and state", () => {
    const url = buildInstagramAuthUrl(
      "https://example.com/callback",
      "state123",
    );
    expect(url).toContain("client_id=test-instagram-client-id");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=state123");
  });

  it("requests instagram_basic and pages_show_list scopes", () => {
    const url = buildInstagramAuthUrl("https://example.com/callback", "abc");
    expect(url).toContain("instagram_basic");
    expect(url).toContain("pages_show_list");
  });

  it("sets response_type to code", () => {
    const url = buildInstagramAuthUrl("https://example.com/callback", "abc");
    expect(url).toContain("response_type=code");
  });
});

describe("exchangeInstagramCode", () => {
  beforeEach(() => vi.resetAllMocks());

  it("posts to the Meta token endpoint and returns parsed JSON", async () => {
    const tokenData = {
      access_token: "ig-access-token-123",
      token_type: "bearer",
    };
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve(tokenData) });

    const result = await exchangeInstagramCode(
      "auth-code",
      "https://example.com/callback",
      mockFetch,
    );

    expect(result).toEqual(tokenData);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends the authorization code and client credentials in the form body", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve({}) });

    await exchangeInstagramCode("my-code", "https://example.com/cb", mockFetch);

    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain("code=my-code");
    expect(body).toContain("client_id=test-instagram-client-id");
    expect(body).toContain("client_secret=test-instagram-client-secret");
    expect(body).toContain("grant_type=authorization_code");
  });

  it("returns the error field from Meta when the exchange fails", async () => {
    const errorResponse = {
      error: { message: "Invalid code" },
    };
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve(errorResponse) });

    const result = await exchangeInstagramCode(
      "bad-code",
      "https://example.com/cb",
      mockFetch,
    );

    expect(result.error?.message).toBe("Invalid code");
  });
});

describe("getInstagramUsername", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the username when present", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: "123456", username: "testuser" }),
    });

    const username = await getInstagramUsername("access-token", mockFetch);

    expect(username).toBe("testuser");
  });

  it("falls back to id when username is absent", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: "123456" }),
    });

    const username = await getInstagramUsername("access-token", mockFetch);

    expect(username).toBe("123456");
  });

  it("returns an empty string when neither username nor id is present", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
    });

    const username = await getInstagramUsername("access-token", mockFetch);

    expect(username).toBe("");
  });

  it("calls the Meta Graph API with the access token in the URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: "1", username: "user" }),
    });

    await getInstagramUsername("my-token", mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("my-token"));
  });
});
