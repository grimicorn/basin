import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getOrCreateTestClerkUser } from "./helpers/clerk";
import { startMockServer } from "./mock-server";
import { truncateE2eData, seedE2eData } from "./seed";

async function runMigrations(dbUrl: string) {
  const sql = neon(dbUrl);
  const db = drizzle(sql);
  const migrationsFolder = path.resolve(__dirname, "../server/db/migrations");
  await migrate(db, { migrationsFolder });
}

export default async function globalSetup() {
  const dbUrl = process.env.E2E_DATABASE_URL;
  if (!dbUrl) throw new Error("E2E_DATABASE_URL is not set");

  console.log("\n[e2e setup] Running migrations...");
  await runMigrations(dbUrl);

  await startMockServer();

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
