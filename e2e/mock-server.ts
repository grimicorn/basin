import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

export const MOCK_PORT = Number(process.env.E2E_MOCK_SERVER_PORT ?? 3099);
export const MOCK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;

const MINIMAL_RSS_FEED =
  '<?xml version="1.0"?><rss version="2.0"><channel><title>Mock Feed</title></channel></rss>';

const BLUESKY_MOCK_SESSION = {
  did: "did:plc:e2emock123",
  handle: "e2etest.bsky.social",
  accessJwt: "mock_access_jwt",
  refreshJwt: "mock_refresh_jwt",
};

let server: Server | null = null;

function parseQueryParams(url: string): URLSearchParams {
  return new URLSearchParams((url ?? "").split("?")[1] ?? "");
}

// ── OAuth 2.0 token exchange (shared by all providers) ───────────────────
function handleTokenExchange(res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      access_token: "mock_access_token",
      refresh_token: "mock_refresh_token",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      token_type: "Bearer",
    }),
  );
}

// ── YouTube: channel info ────────────────────────────────────────────────
function handleYouTubeChannels(res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      items: [
        {
          snippet: {
            customUrl: "@e2etestchannel",
            title: "E2E Test Channel",
          },
        },
      ],
    }),
  );
}

// ── Bluesky: create session (app password auth) ──────────────────────────
function handleBlueskySession(res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(BLUESKY_MOCK_SESSION));
}

// ── Feed proxy: returns a minimal valid RSS feed for any URL ─────────────
// Used by the feed validator (FEED_FETCH_PROXY_URL) so e2e tests never
// make real outbound HTTP requests when adding a feed.
function handleFeedProxy(req: IncomingMessage, res: ServerResponse): void {
  const feedUrl = parseQueryParams(req.url ?? "").get("url");

  if (!feedUrl) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing required query parameter: url" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/rss+xml" });
  res.end(MINIMAL_RSS_FEED);
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  const method = req.method ?? "GET";
  const path = (req.url ?? "/").split("?")[0];

  if (method === "POST" && path === "/token") return handleTokenExchange(res);
  if (method === "GET" && path === "/youtube/v3/channels")
    return handleYouTubeChannels(res);
  if (method === "GET" && path === "/feed-proxy")
    return handleFeedProxy(req, res);
  if (method === "POST" && path === "/xrpc/com.atproto.server.createSession")
    return handleBlueskySession(res);

  // Add future providers here:
  // ── Instagram: user info ─────────────────────────────────────────────────
  // if (method === "GET" && path.startsWith("/v20.0/me")) { ... }

  // Loud 404 so missing mocks are immediately obvious in the test output
  console.error(`[mock-server] No handler for ${method} ${path}`);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: `No mock handler for ${method} ${path}` }));
}

export function startMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = createServer(handle);
    server.listen(MOCK_PORT, "127.0.0.1", () => {
      console.log(`\n[mock-server] Listening on ${MOCK_BASE_URL}`);
      resolve();
    });
    server.on("error", reject);
  });
}

export function stopMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => {
      server = null;
      err ? reject(err) : resolve();
    });
  });
}
