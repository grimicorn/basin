# Third-Party API Auth Storage

A single `integrations` table handles YouTube and Twitter — the providers
differ enough (OAuth 1.0a vs 2.0, expiry behavior) that you need flexible nullable
fields, but not so much that separate tables are worth it.

---

## Schema

```ts
export const integrations = pgTable(
  "integrations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    provider: text("provider").notNull(), // 'youtube' | 'twitter'

    // Tokens — always encrypted at rest
    accessToken: text("access_token").notNull(), // all providers
    refreshToken: text("refresh_token"), // OAuth 2.0 only (YouTube)
    tokenSecret: text("token_secret"), // OAuth 1.0a only (Twitter v1.1)

    // Lifecycle
    expiresAt: timestamp("expires_at"), // null = non-expiring
    scopes: text("scopes").array().default([]),

    // Enough to show the user what's connected — no extra API calls needed
    providerAccountId: text("provider_account_id"), // platform's user ID
    providerUsername: text("provider_username"), // @handle / channel name

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqueUserProvider: unique().on(t.userId, t.provider),
  }),
);
```

---

## Encryption (non-negotiable)

Tokens should never touch the DB as plain text. AES-256-GCM is the right choice —
authenticated encryption, so you also detect tampering. Implemented in
[`server/utils/crypto.ts`](../server/utils/crypto.ts):

- `encryptToken(plaintext)` / `decryptToken(stored)` — the core encrypt/decrypt
  pair, storing `iv:authTag:ciphertext` as hex so decrypt is self-contained.
- `isEncryptedToken(stored)` — detects the `iv:authTag:ciphertext` shape (fixed
  IV/auth-tag lengths), used to tell ciphertext apart from legacy plaintext.
- `decryptTokenTolerant(stored)` / `decryptNullableTokenTolerant(stored)` —
  read-path wrappers that pass a legacy plaintext value through unchanged
  instead of throwing, so rows written before encryption existed keep working.
  Run `npm run tokens:backfill` (see below) to migrate them to ciphertext.
- `TokenEncryptionKeyError` — thrown when `TOKEN_ENCRYPTION_KEY` is missing or
  isn't 32 bytes of hex.

Generate your key once per environment and store it in your environment (see
`.env.example`) — don't reuse the same key across environments:

```bash
openssl rand -hex 32
```

### Migrating existing plaintext rows

Rows written before this encryption existed are read tolerantly (see
`decryptTokenTolerant` above) so nothing breaks, but they still hold plaintext
until backfilled. Run once per environment:

```bash
npm run tokens:backfill                      # local (.env)
dotenvx run -f .env.production -- node scripts/backfill-encrypt-tokens.ts
```

It's idempotent — already-encrypted fields (detected via `isEncryptedToken`)
are left untouched, so it's safe to re-run.

---

## Token Refresh Utility

YouTube tokens expire — wrap access in a utility that handles it automatically:

```ts
// server/utils/integrations.ts
export async function getValidToken(userId: number, provider: string) {
  const row = await db.query.integrations.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.userId, userId), eq(t.provider, provider)),
  });

  if (!row) throw new Error(`No ${provider} connection found`);

  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry
  const isExpired =
    row.expiresAt && row.expiresAt < new Date(Date.now() + bufferMs);

  if (isExpired && row.refreshToken) {
    return refreshAndStore(row); // call provider's token endpoint, update DB
  }

  return decrypt(row.accessToken);
}
```

---

## Per-Provider Notes

| Provider | OAuth version | Expiry       | Notes                                              |
| -------- | ------------- | ------------ | -------------------------------------------------- |
| YouTube  | 2.0           | 1 hour       | `accessToken` + `refreshToken`, refresh via Google |
| Twitter  | 1.0a or 2.0   | Never (1.0a) | 1.0a needs `tokenSecret`, 2.0 behaves like YouTube |

Twitter's v2 API supports OAuth 2.0 now but some endpoints still require 1.0a —
worth keeping `tokenSecret` around even if you go 2.0 for most things.
