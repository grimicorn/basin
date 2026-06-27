# Reader

All your content feeds — RSS, podcasts, YouTube, and Bluesky — in one quiet, chronological place.

## Requirements

- Node.js >= 24 (see [.nvmrc](.nvmrc))
- npm

## Setup

Install dependencies:

```bash
npm install
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values before running the app:

```bash
cp .env.example .env
```

| Variable                            | Purpose                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                      | Neon connection string — used by `drizzle-kit` CLI commands |
| `NUXT_DATABASE_URL`                 | Same Neon connection string — read by Nuxt at runtime       |
| `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (safe to expose to the browser)       |
| `NUXT_CLERK_SECRET_KEY`             | Clerk secret key (server-only, never exposed to the client) |

Get your Clerk keys from the [Clerk dashboard](https://dashboard.clerk.com) → API Keys.
Get your Neon connection string from the [Neon console](https://console.neon.tech) → your project → Connection Details.

## Database

The app uses [Drizzle ORM](https://orm.drizzle.team) with a [Neon](https://neon.tech) serverless Postgres database.

### Schema

The schema lives in [`server/db/schema.ts`](server/db/schema.ts). Tables:

| Table           | Description                                               |
| --------------- | --------------------------------------------------------- |
| `users`         | One row per authenticated user, keyed by Clerk's `userId` |
| `feeds`         | RSS and podcast feeds belonging to a user                 |
| `feed_items`    | Individual items fetched from a feed                      |
| `integrations`  | OAuth tokens for YouTube and Bluesky (encrypted at rest)  |
| `user_settings` | Per-user reading preferences                              |

### Database commands

Push the schema directly to Neon (useful for initial setup or during development):

```bash
npm run db:push
```

Generate a SQL migration file from schema changes:

```bash
npm run db:generate
```

Apply pending migrations:

```bash
npm run db:migrate
```

Open Drizzle Studio (visual database browser):

```bash
npm run db:studio
```

### Using the DB in server routes

`useDb()` is auto-imported in all Nitro server files:

```ts
// server/api/example.get.ts
export default defineEventHandler((event) => {
  const db = useDb();
  const user = event.context.user; // set by server/middleware/auth.ts
  return db.query.feedItems.findMany({
    where: (t, { eq }) => eq(t.feedId, user.id),
  });
});
```

## Authentication

Authentication is handled by [Clerk](https://clerk.com) via the [`@clerk/nuxt`](https://clerk.com/docs/references/nuxt/overview) module.

### How it works

1. `@clerk/nuxt` is registered in `nuxt.config.ts` and automatically protects routes via its built-in middleware
2. `app/middleware/auth.global.ts` — client-side route guard that redirects unauthenticated users to `/login` and signed-in users away from `/login`
3. `server/middleware/auth.ts` — runs on every server request; reads `event.context.auth()` (set by Clerk) and upserts the user into Neon via `getOrCreateUser()`
4. `event.context.user` is then available in all downstream API route handlers

### Client composables

```ts
const { user } = useUser(); // reactive Clerk user object
const clerk = useClerk(); // ShallowRef<Clerk> — low-level access
const { isSignedIn } = useAuth(); // reactive auth state
```

### Sign out

```ts
const clerk = useClerk();
clerk.value?.signOut({ redirectUrl: "/login" });
```

## Offline / PGlite

The app uses [PGlite](https://pglite.dev) (`@electric-sql/pglite`) — a WASM build of Postgres running entirely in the browser, persisted via IndexedDB. This allows reads and writes to work without a network connection.

### How it works

1. `app/composables/useClientDb.ts` — lazy-initialises a PGlite instance at `idb://reader-app` and applies the DDL migrations on first load. Returns a Drizzle client with the same query API as the server.
2. `app/db/schema.ts` — client-side schema with three tables: `feeds`, `feed_items`, and `sync_queue`. No server-only tables (users, integrations, userSettings).
3. `app/composables/useSyncQueue.ts` — queues offline mutations to `sync_queue`, then flushes them to `POST /api/sync` when back online.
4. `app/plugins/sync.client.ts` — registers `online` and `visibilitychange` listeners that trigger a flush automatically.
5. `server/api/sync.post.ts` — applies queued mutations (`markRead`, `star`, `save`) to the Neon server DB.

### Usage

```ts
// Read or write locally (works offline)
const db = await useClientDb();
const items = await db.query.feedItems.findMany({ ... });

// Queue an action for server sync
const { queueAction } = useSyncQueue();
await queueAction("markRead", { guid: item.guid });

// Flush manually (called automatically on reconnect)
const { flushSyncQueue } = useSyncQueue();
await flushSyncQueue();
```

### Notes

- PGlite is excluded from Vite's `optimizeDeps` (`exclude: ['@electric-sql/pglite']`) to prevent Vite from trying to pre-bundle the WASM binary.
- The client schema intentionally omits foreign key constraints — PGlite is a local cache, not the source of truth.
- `sync_queue.syncedAt` is `null` for pending items; the flush loop stops on the first failure and retries on the next trigger.

## Development

Start the dev server at `http://localhost:3000`:

```bash
npm run dev
```

## Testing

Run tests in watch mode:

```bash
npm test
```

Run tests once (CI mode):

```bash
npm run test:ci
```

Open the Vitest UI:

```bash
npm run test:ui
```

## Linting

Check for lint and formatting issues:

```bash
npm run lint
```

Auto-fix issues:

```bash
npm run lint:fix
```

## Build & Preview

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deployment

The app deploys to Netlify automatically on push to `main` or `dev`. The build command runs tests before building:

```bash
npm run test:ci && npm run build
```

## Security scanning

The repo runs a deterministic security-scanner layer — secret detection and dependency vulnerability auditing — both locally and in CI.

### Secret scanning (gitleaks)

[gitleaks](https://github.com/gitleaks/gitleaks) scans for committed secrets using the rules in [`.gitleaks.toml`](.gitleaks.toml), which extend the bundled default ruleset with project-specific rules for Clerk secret keys (`sk_live_`/`sk_test_`) and Postgres/Neon connection strings that embed credentials.

- **Locally:** the [`.husky/pre-commit`](.husky/pre-commit) hook runs `gitleaks git --staged` and blocks the commit on any finding. Install gitleaks first ([instructions](https://github.com/gitleaks/gitleaks#installing)); if it is not installed the hook prints a warning and skips the scan rather than failing.
- **In CI:** the `secret-scan` job downloads the pinned gitleaks release and runs the binary directly — scanning the PR commit range on pull requests and the full history on pushes to `main`. Any finding fails the build.

Run the staged scan manually:

```bash
gitleaks git --staged --config .gitleaks.toml --verbose
```

### Dependency auditing

The `dependency-audit` CI job runs `npm audit` and **fails the build only on high or critical advisories**. Moderate and low advisories are printed as an informational summary without failing. [Dependabot](.github/dependabot.yml) opens grouped weekly PRs for minor and patch updates.

## Git Hooks

Husky runs two hooks. A **pre-commit** hook runs the gitleaks staged-secret scan (see [Security scanning](#security-scanning)). A **pre-push** hook runs lint and tests. To skip hooks in CI, set `HUSKY=0`.
