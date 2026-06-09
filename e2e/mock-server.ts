import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

export const MOCK_PORT = Number(process.env.E2E_MOCK_SERVER_PORT ?? 3099);
export const MOCK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;

let server: Server | null = null;

function handle(req: IncomingMessage, res: ServerResponse): void {
  const method = req.method ?? "GET";
  const path = (req.url ?? "/").split("?")[0];

  // ── OAuth 2.0 token exchange (shared by all providers) ───────────────────
  if (method === "POST" && path === "/token") {
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
    return;
  }

  // ── YouTube: channel info ────────────────────────────────────────────────
  if (method === "GET" && path === "/youtube/v3/channels") {
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
    return;
  }

  // Add future providers here:
  // ── X (Twitter): user lookup ─────────────────────────────────────────────
  // if (method === "GET" && path === "/2/users/me") { ... }
  //
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
