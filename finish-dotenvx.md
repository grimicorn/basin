# Claude Output

## dotenvx migration — manual steps for `basin` (branch `dh-dotenvx`)

Code/config changes are done and verified (917 unit tests pass, lint clean, all
4 files decrypt, pre-commit guard passes). I did **not** commit. The steps below
are the out-of-band pieces I can't/shouldn't do for you (they touch private keys
and external services). `dotenvx` isn't installed globally, so each command uses
`npx dotenvx`. Run any of these with `! <command>` if you want output in-session.

### 1. Set the local + preview DB URLs (do this first — local DB is empty by design)

`npm run dev` will fail until you point `.env` at your Neon **dev** branch:

```bash
npx dotenvx set DATABASE_URL "<neon-dev-branch-url>" -f .env
npx dotenvx set NUXT_DATABASE_URL "<neon-dev-branch-url>" -f .env
# preview/branch deploys (.env.dev) — a non-prod branch:
npx dotenvx set DATABASE_URL "<neon-preview-branch-url>" -f .env.dev
npx dotenvx set NUXT_DATABASE_URL "<neon-preview-branch-url>" -f .env.dev
```

`.env.production` and `.env.e2e` already hold real values (prod = ep-shy-water,
e2e = ep-winter-cloud).

### 2. Back up `.env.keys` to your password manager

One entry, e.g. "basin dotenv keys". **Lose this and the encrypted files are
unrecoverable.** It holds all four private keys.

### 3. GitHub Actions secret (for CI e2e)

```bash
gh secret set DOTENV_PRIVATE_KEY_E2E \
  --body "$(grep '^DOTENV_PRIVATE_KEY_E2E=' .env.keys | cut -d= -f2- | tr -d '\"')"
```

After one green e2e run, delete the now-unused Actions secrets:
`NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NUXT_CLERK_SECRET_KEY`,
`NUXT_GOOGLE_CLIENT_ID`, `NUXT_GOOGLE_CLIENT_SECRET`. Keep `NEON_API_KEY` and
`NEON_PROJECT_ID`.

### 4. Netlify env vars (Builds scope)

```bash
npx netlify-cli env:set DOTENV_PRIVATE_KEY_PRODUCTION \
  "$(grep '^DOTENV_PRIVATE_KEY_PRODUCTION=' .env.keys | cut -d= -f2- | tr -d '\"')"
npx netlify-cli env:set DOTENV_PRIVATE_KEY_DEV \
  "$(grep '^DOTENV_PRIVATE_KEY_DEV=' .env.keys | cut -d= -f2- | tr -d '\"')"
```

Keep `SENTRY_DSN` set in Netlify (Functions scope) — the server Sentry init
reads it at runtime; it's not baked. After a verified deploy that queries Neon
OK, remove the now-redundant Netlify vars (`NUXT_DATABASE_URL`, `DATABASE_URL`,
`NUXT_CLERK_SECRET_KEY`, `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`NUXT_GOOGLE_CLIENT_ID`, `NUXT_GOOGLE_CLIENT_SECRET`) — they're baked into the
build via runtimeConfig now.

### 5. Verify, then commit

```bash
npm run dev        # after step 1
npm run e2e        # local e2e against the encrypted .env.e2e
```

Then `git add .env .env.dev .env.e2e .env.production` plus the modified files and
commit. The pre-commit hook will refuse any plaintext `.env*`.

### For Wanderist / Markpost (repos 2 and 3)

Same playbook. Markpost: if it has no server-side secrets it may only need `.env`

- `.env.e2e` and can skip the Netlify section.
