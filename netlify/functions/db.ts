import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../server/db/schema";
import { loadEnv } from "./env";

export function createDb() {
  loadEnv();

  const databaseUrl = process.env.NUXT_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("NUXT_DATABASE_URL environment variable is not set");
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}
