// One-off backfill: encrypts any integrations.accessToken / refreshToken /
// tokenSecret still stored in legacy plaintext (rows written before AES-256-GCM
// encryption was added — see docs/api-auth-storage.md and issue #120).
// Safe to run repeatedly: already-encrypted values are detected via
// isEncryptedToken and left untouched, so this never re-encrypts ciphertext.
//
// Uses raw SQL rather than the Drizzle schema/query builder: this script runs
// directly via `node` (Node's native TypeScript type-stripping), not through
// a bundler, and server/db/schema.ts's own relative imports are extensionless
// (only ever loaded through Nitro/Vite, which resolves those) — importing it
// here fails with ERR_MODULE_NOT_FOUND. Raw SQL avoids the whole module graph.
//
// Usage:
//   dotenvx run -f .env -- node scripts/backfill-encrypt-tokens.ts
//   dotenvx run -f .env.production -- node scripts/backfill-encrypt-tokens.ts
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import { encryptToken, isEncryptedToken } from "../server/utils/crypto.ts";

type IntegrationTokenRow = {
  id: number;
  accessToken: string;
  refreshToken: string | null;
  tokenSecret: string | null;
};

type TokenFieldUpdate = Partial<
  Pick<IntegrationTokenRow, "accessToken" | "refreshToken" | "tokenSecret">
>;

// Structural type for neon's tagged-template SQL client — loose enough that
// tests can substitute a fake without needing a real Neon connection.
type SqlTag = (
  _strings: TemplateStringsArray,
  ..._values: unknown[]
) => Promise<unknown[]>;

type EncryptResult<T> = { value: T; changed: boolean };

// Encrypts a legacy plaintext value; leaves an already-encrypted value as-is.
// `changed` tells the caller whether this field needs writing back at all.
function encryptIfLegacy(value: string): EncryptResult<string> {
  if (isEncryptedToken(value)) {
    return { value, changed: false };
  }
  return { value: encryptToken(value), changed: true };
}

function encryptNullableIfLegacy(
  value: string | null,
): EncryptResult<string | null> {
  if (value === null) {
    return { value: null, changed: false };
  }
  return encryptIfLegacy(value);
}

// Exported for unit testing — pure function, no DB access.
export function buildTokenUpdate(row: IntegrationTokenRow): TokenFieldUpdate {
  const accessToken = encryptIfLegacy(row.accessToken);
  const refreshToken = encryptNullableIfLegacy(row.refreshToken);
  const tokenSecret = encryptNullableIfLegacy(row.tokenSecret);

  const update: TokenFieldUpdate = {};

  if (accessToken.changed) {
    update.accessToken = accessToken.value;
  }

  if (refreshToken.changed) {
    update.refreshToken = refreshToken.value;
  }

  if (tokenSecret.changed) {
    update.tokenSecret = tokenSecret.value;
  }

  return update;
}

function connectToDatabase(): SqlTag {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Run this script via `dotenvx run -f <env-file> -- node scripts/backfill-encrypt-tokens.ts`.",
    );
  }

  return neon(databaseUrl) as unknown as SqlTag;
}

async function fetchIntegrationTokenRows(
  sql: SqlTag,
): Promise<IntegrationTokenRow[]> {
  const rows = await sql`
    SELECT
      id,
      access_token AS "accessToken",
      refresh_token AS "refreshToken",
      token_secret AS "tokenSecret"
    FROM integrations
  `;
  return rows as IntegrationTokenRow[];
}

type BackfillOutcome =
  "updated" | "already-encrypted" | "skipped-concurrent-change";

// Guards the UPDATE with the exact values read in fetchIntegrationTokenRows:
// if a user reconnected (re-encrypting the row for real) between the SELECT
// above and this write, the WHERE clause no longer matches and the stale
// backfill write becomes a no-op instead of clobbering the fresh value.
export async function backfillRow(
  sql: SqlTag,
  row: IntegrationTokenRow,
): Promise<BackfillOutcome> {
  const update = buildTokenUpdate(row);

  if (Object.keys(update).length === 0) {
    return "already-encrypted";
  }

  const nextAccessToken = update.accessToken ?? row.accessToken;
  const nextRefreshToken = update.refreshToken ?? row.refreshToken;
  const nextTokenSecret = update.tokenSecret ?? row.tokenSecret;

  const updatedRows = await sql`
    UPDATE integrations
    SET
      access_token = ${nextAccessToken},
      refresh_token = ${nextRefreshToken},
      token_secret = ${nextTokenSecret},
      updated_at = now()
    WHERE id = ${row.id}
      AND access_token = ${row.accessToken}
      AND refresh_token IS NOT DISTINCT FROM ${row.refreshToken}
      AND token_secret IS NOT DISTINCT FROM ${row.tokenSecret}
    RETURNING id
  `;

  return updatedRows.length > 0 ? "updated" : "skipped-concurrent-change";
}

async function main(): Promise<void> {
  const sql = connectToDatabase();
  const rows = await fetchIntegrationTokenRows(sql);

  let updatedCount = 0;
  let skippedDueToConcurrentChangeCount = 0;

  for (const row of rows) {
    const outcome = await backfillRow(sql, row);

    if (outcome === "updated") {
      updatedCount += 1;
    }

    if (outcome === "skipped-concurrent-change") {
      skippedDueToConcurrentChangeCount += 1;
    }
  }

  console.log(
    `Scanned ${rows.length} integration row(s); encrypted ${updatedCount} row(s) with legacy plaintext token fields.` +
      (skippedDueToConcurrentChangeCount > 0
        ? ` Skipped ${skippedDueToConcurrentChangeCount} row(s) that changed concurrently — re-run to pick them up.`
        : ""),
  );
}

function isDirectInvocation(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectInvocation()) {
  main().catch((error) => {
    console.error("backfill-encrypt-tokens failed:", error);
    process.exit(1);
  });
}
