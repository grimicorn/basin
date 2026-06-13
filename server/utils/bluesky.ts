// Configurable so e2e tests can point this at a local mock server.
// Set BLUESKY_SESSION_URL in the environment to override.
const BLUESKY_SESSION_URL =
  process.env.BLUESKY_SESSION_URL ??
  "https://bsky.social/xrpc/com.atproto.server.createSession";

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

export async function createBlueskySession(
  identifier: string,
  appPassword: string,
): Promise<BlueskySession> {
  const response = await fetch(BLUESKY_SESSION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password: appPassword }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Bluesky authentication failed: ${response.status}`);
  }

  return response.json() as Promise<BlueskySession>;
}
