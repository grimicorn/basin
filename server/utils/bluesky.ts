// Configurable so e2e tests can point these at a local mock server.
// Set these env vars to override the defaults.
const BLUESKY_SESSION_URL =
  process.env.BLUESKY_SESSION_URL ??
  "https://bsky.social/xrpc/com.atproto.server.createSession";

const BLUESKY_TIMELINE_URL =
  process.env.BLUESKY_TIMELINE_URL ??
  "https://bsky.social/xrpc/app.bsky.feed.getTimeline";

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  record: {
    text: string;
    createdAt: string;
  };
  likeCount?: number;
  repostCount?: number;
  indexedAt: string;
}

export interface BlueskyTimelineFeed {
  feed: Array<{ post: BlueskyPost }>;
  cursor?: string;
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

export async function fetchBlueskyTimeline(
  accessJwt: string,
  limit = 50,
): Promise<BlueskyTimelineFeed> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`${BLUESKY_TIMELINE_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessJwt}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Bluesky timeline fetch failed: ${response.status}`);
  }

  return response.json() as Promise<BlueskyTimelineFeed>;
}
