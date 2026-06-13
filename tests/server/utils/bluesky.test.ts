import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { createBlueskySession } from "../../../server/utils/bluesky";

const mockSession = {
  did: "did:plc:abc123",
  handle: "you.bsky.social",
  accessJwt: "access-jwt-token",
  refreshJwt: "refresh-jwt-token",
};

describe("createBlueskySession", () => {
  beforeEach(() => vi.resetAllMocks());

  it("posts to the Bluesky createSession endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    await createBlueskySession("you.bsky.social", "xxxx-xxxx-xxxx-xxxx");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends handle and app password in the request body as JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    await createBlueskySession("you.bsky.social", "xxxx-xxxx-xxxx-xxxx");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      identifier: "you.bsky.social",
      password: "xxxx-xxxx-xxxx-xxxx",
    });
  });

  it("sets Content-Type to application/json", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    await createBlueskySession("you.bsky.social", "xxxx-xxxx-xxxx-xxxx");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("returns the parsed session object on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    const session = await createBlueskySession(
      "you.bsky.social",
      "xxxx-xxxx-xxxx-xxxx",
    );

    expect(session).toEqual(mockSession);
  });

  it("throws when the API returns a non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      createBlueskySession("you.bsky.social", "bad-password"),
    ).rejects.toThrow("Bluesky authentication failed: 401");
  });
});
