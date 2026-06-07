# Reader

All your content feeds — RSS, podcasts, YouTube, X, and Instagram — in one quiet, chronological place.

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

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string — used by `drizzle-kit` CLI commands |
| `NUXT_DATABASE_URL` | Same Neon connection string — read by Nuxt at runtime |
| `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (safe to expose to the browser) |
| `NUXT_CLERK_SECRET_KEY` | Clerk secret key (server-only, never exposed to the client) |

Get your Clerk keys from the [Clerk dashboard](https://dashboard.clerk.com) → API Keys.
Get your Neon connection string from the [Neon console](https://console.neon.tech) → your project → Connection Details.

## Database

The app uses [Drizzle ORM](https://orm.drizzle.team) with a [Neon](https://neon.tech) serverless Postgres database.

### Schema

The schema lives in [`server/db/schema.ts`](server/db/schema.ts). Tables:

| Table | Description |
|---|---|
| `users` | One row per authenticated user, keyed by Clerk's `userId` |
| `feeds` | RSS and podcast feeds belonging to a user |
| `feed_items` | Individual items fetched from a feed |
| `integrations` | OAuth tokens for YouTube, Instagram, and Twitter (encrypted at rest) |
| `user_settings` | Per-user reading preferences |

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
  const db = useDb()
  const user = event.context.user  // set by server/middleware/auth.ts
  return db.query.feedItems.findMany({
    where: (t, { eq }) => eq(t.feedId, user.id),
  })
})
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
const { user } = useUser()          // reactive Clerk user object
const clerk = useClerk()            // ShallowRef<Clerk> — low-level access
const { isSignedIn } = useAuth()    // reactive auth state
```

### Sign out

```ts
const clerk = useClerk()
clerk.value?.signOut({ redirectUrl: '/login' })
```

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

## Git Hooks

A pre-push hook runs via Husky. To skip hooks in CI, set `HUSKY=0`.
