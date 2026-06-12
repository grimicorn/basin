import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

export const MOCK_PORT = Number(process.env.E2E_MOCK_SERVER_PORT ?? 3099);
export const MOCK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;

let server: Server | null = null;

type RouteKey = `${"GET" | "POST"} ${string}`;
type RouteHandler = (_res: ServerResponse) => void;

function jsonOk(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const routes: Record<RouteKey, RouteHandler> = {
  // ── OAuth 2.0 token exchange (shared by all providers) ───────────────────
  "POST /token": (res) =>
    jsonOk(res, {
      access_token: "mock_access_token",
      refresh_token: "mock_refresh_token",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      token_type: "Bearer",
    }),

  // ── YouTube: channel info ────────────────────────────────────────────────
  "GET /youtube/v3/channels": (res) =>
    jsonOk(res, {
      items: [
        {
          snippet: {
            customUrl: "@e2etestchannel",
            title: "E2E Test Channel",
          },
        },
      ],
    }),

  // ── Instagram: token exchange ────────────────────────────────────────────
  "POST /v19.0/oauth/access_token": (res) =>
    jsonOk(res, {
      access_token: "mock_instagram_access_token",
      token_type: "bearer",
    }),

  // ── Instagram: user info ─────────────────────────────────────────────────
  "GET /v19.0/me": (res) =>
    jsonOk(res, {
      id: "123456789",
      username: "e2etestuser",
    }),

  // Add future providers here:
  // "GET /2/users/me": (res) => jsonOk(res, { ... }),  // X (Twitter)
};

function handle(req: IncomingMessage, res: ServerResponse): void {
  const method = (req.method ?? "GET") as "GET" | "POST";
  const path = (req.url ?? "/").split("?")[0];
  const key: RouteKey = `${method} ${path}`;
  const handler = routes[key];

  if (handler) {
    handler(res);
    return;
  }

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
