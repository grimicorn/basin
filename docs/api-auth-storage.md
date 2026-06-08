# Third-Party API Auth Storage

A single `integrations` table handles YouTube, Instagram, and Twitter — the providers
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
    provider: text("provider").notNull(), // 'youtube' | 'instagram' | 'twitter'

    // Tokens — always encrypted at rest
    accessToken: text("access_token").notNull(), // all providers
    refreshToken: text("refresh_token"), // OAuth 2.0 only (YouTube, Instagram)
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
authenticated encryption, so you also detect tampering:

```ts
// server/utils/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Store iv + tag + ciphertext together so decrypt is self-contained
  return [iv, tag, encrypted].map((b) => b.toString("hex")).join(":");
}

export function decrypt(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(dataHex, "hex")) + decipher.final("utf8");
}
```

Generate your key once and store it in your environment:

```bash
openssl rand -hex 32
```

---

## Token Refresh Utility

YouTube and Instagram tokens expire — wrap access in a utility that handles
it automatically:

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

| Provider  | OAuth version | Expiry       | Notes                                              |
| --------- | ------------- | ------------ | -------------------------------------------------- |
| YouTube   | 2.0           | 1 hour       | `accessToken` + `refreshToken`, refresh via Google |
| Instagram | 2.0           | 60 days      | Long-lived token, refresh before expiry            |
| Twitter   | 1.0a or 2.0   | Never (1.0a) | 1.0a needs `tokenSecret`, 2.0 behaves like YouTube |

Twitter's v2 API supports OAuth 2.0 now but some endpoints still require 1.0a —
worth keeping `tokenSecret` around even if you go 2.0 for most things.
