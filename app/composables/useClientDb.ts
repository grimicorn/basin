import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  feeds,
  feedItems,
  feedsRelations,
  feedItemsRelations,
  syncQueue,
} from "~/db/schema";

const schema = {
  feeds,
  feedItems,
  feedsRelations,
  feedItemsRelations,
  syncQueue,
};
type ClientDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: ClientDb | null = null;

// DDL kept in sync with app/db/schema.ts — run once on first init.
const MIGRATIONS = /* sql */ `
  CREATE TABLE IF NOT EXISTS feeds (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    url        TEXT NOT NULL,
    title      TEXT,
    description TEXT,
    last_fetched TIMESTAMP,
    source     TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, url)
  );

  CREATE TABLE IF NOT EXISTS feed_items (
    id           SERIAL PRIMARY KEY,
    feed_id      INTEGER NOT NULL,
    guid         TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    url          TEXT,
    content      TEXT,
    tags         TEXT[],
    published_at TIMESTAMP,
    read_at      TIMESTAMP,
    starred      BOOLEAN DEFAULT FALSE,
    saved_at     TIMESTAMP,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id         SERIAL PRIMARY KEY,
    action     TEXT NOT NULL,
    payload    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    synced_at  TIMESTAMP
  );
`;

export async function useClientDb(): Promise<ClientDb> {
  if (_db) return _db;

  const client = new PGlite("idb://reader-app");
  await client.exec(MIGRATIONS);
  _db = drizzle(client, { schema });

  return _db;
}
