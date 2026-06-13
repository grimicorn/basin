import path from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getOrCreateTestClerkUser } from "./helpers/clerk";
import { startMockServer } from "./mock-server";
import { truncateE2eData, seedE2eData } from "./seed";

const MIGRATIONS_DIR = path.resolve("./server/db/migrations");

async function applyMigrations(dbUrl: string) {
  const sql = neon(dbUrl);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

export default async function globalSetup() {
  const dbUrl = process.env.E2E_DATABASE_URL;
  if (!dbUrl) throw new Error("E2E_DATABASE_URL is not set");

  await startMockServer();

  console.log("[e2e setup] Applying pending migrations...");
  await applyMigrations(dbUrl);

  console.log("\n[e2e setup] Truncating existing data...");
  await truncateE2eData(dbUrl);

  console.log("[e2e setup] Ensuring Clerk test user exists...");
  const user = await getOrCreateTestClerkUser();

  console.log("[e2e setup] Seeding test data...");
  await seedE2eData(dbUrl, user.id);

  // Auth storageState is created by the 'setup' test project after
  // the webServer is running (see e2e/tests/auth.setup.ts).
  console.log("[e2e setup] Done.\n");
}
