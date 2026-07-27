// One-off backfill: encrypts any integrations.accessToken / refreshToken /
// tokenSecret still stored in legacy plaintext (rows written before AES-256-GCM
// encryption was added — see docs/api-auth-storage.md and issue #120).
// Safe to run repeatedly: already-encrypted values are detected via
// isEncryptedToken and left untouched, so this never re-encrypts ciphertext.
//
// Usage:
//   dotenvx run -f .env -- node scripts/backfill-encrypt-tokens.ts
//   dotenvx run -f .env.production -- node scripts/backfill-encrypt-tokens.ts
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../server/db/schema";
import { integrations } from "../server/db/schema";
import { encryptToken, isEncryptedToken } from "../server/utils/crypto";

type IntegrationTokenRow = {
  id: number;
  accessToken: string;
  refreshToken: string | null;
  tokenSecret: string | null;
};

type TokenFieldUpdate = Partial<
  Pick<IntegrationTokenRow, "accessToken" | "refreshToken" | "tokenSecret">
>;

// Exported for unit testing — pure function, no DB access.
export function buildTokenUpdate(row: IntegrationTokenRow): TokenFieldUpdate {
  const update: TokenFieldUpdate = {};

  if (!isEncryptedToken(row.accessToken)) {
    update.accessToken = encryptToken(row.accessToken);
  }

  if (row.refreshToken !== null && !isEncryptedToken(row.refreshToken)) {
    update.refreshToken = encryptToken(row.refreshToken);
  }

  if (row.tokenSecret !== null && !isEncryptedToken(row.tokenSecret)) {
    update.tokenSecret = encryptToken(row.tokenSecret);
  }

  return update;
}

function connectToDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Run this script via `dotenvx run -f <env-file> -- node scripts/backfill-encrypt-tokens.ts`.",
    );
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

async function backfillRow(
  db: ReturnType<typeof connectToDatabase>,
  row: IntegrationTokenRow,
): Promise<boolean> {
  const update = buildTokenUpdate(row);

  if (Object.keys(update).length === 0) {
    return false;
  }

  await db.update(integrations).set(update).where(eq(integrations.id, row.id));
  return true;
}

async function main(): Promise<void> {
  const db = connectToDatabase();

  const rows = await db.query.integrations.findMany({
    columns: {
      id: true,
      accessToken: true,
      refreshToken: true,
      tokenSecret: true,
    },
  });

  let updatedCount = 0;
  for (const row of rows) {
    const wasUpdated = await backfillRow(db, row);
    if (wasUpdated) {
      updatedCount += 1;
    }
  }

  console.log(
    `Scanned ${rows.length} integration row(s); encrypted ${updatedCount} row(s) with legacy plaintext token fields.`,
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
    console.error(`backfill-encrypt-tokens failed: ${error.message}`);
    process.exit(1);
  });
}
