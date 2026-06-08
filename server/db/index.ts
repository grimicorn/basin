import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function useDb() {
  const { databaseUrl } = useRuntimeConfig();
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}
