# Offline-First Reader App: Drizzle + PGlite + Neon

See docs/offline-sync-queue.md for DB table info

A layered offline strategy for a Nuxt reader app (RSS, Podcasts, YouTube) using a shared
Drizzle schema across client (PGlite) and server (Neon).

---

## The Offline Problem Has Two Parts

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Content Caching                        │
│  "I already loaded this article — let me read   │
│   it without wifi"                               │
├─────────────────────────────────────────────────┤
│  Layer 2: State Sync                             │
│  "I marked this as read offline — sync it       │
│   when I'm back online"                          │
└─────────────────────────────────────────────────┘
```

---

## Layer 1 — Content Caching (Service Workers)

Cache fetched articles, podcast metadata, and thumbnails so already-loaded content
is readable offline.

### Install

```bash
npm install @vite-pwa/nuxt
```

### nuxt.config.ts

```ts
export default defineNuxtConfig({
  modules: ["@vite-pwa/nuxt"],
  pwa: {
    strategies: "generateSW",
    registerType: "autoUpdate",
    manifest: {
      name: "My Reader App",
      short_name: "Reader",
      theme_color: "#ffffff",
    },
    workbox: {
      runtimeCaching: [
        {
          // Cache article API responses
          urlPattern: /\/api\/articles\/.*/,
          handler: "CacheFirst",
          options: {
            cacheName: "articles-cache",
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
            },
          },
        },
        {
          // Cache feed thumbnails and images
          urlPattern: /\.(png|jpg|jpeg|webp|svg)$/,
          handler: "CacheFirst",
          options: {
            cacheName: "image-cache",
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            },
          },
        },
        {
          // Network-first for feed list (fresh when online, fallback when not)
          urlPattern: /\/api\/feeds/,
          handler: "NetworkFirst",
          options: {
            cacheName: "feeds-cache",
          },
        },
      ],
    },
  },
});
```

This alone covers the most common offline use case — users can read any article
they've previously opened, even without a connection.

---

## Layer 2 — Local Database with PGlite

PGlite runs a full PostgreSQL instance compiled to WASM in the browser. Since Neon
is also Postgres, you can share the same Drizzle schema on both sides — no
impedance mismatch, identical query syntax everywhere.

### Install

```bash
npm install @electric-sql/pglite drizzle-orm
npm install -D drizzle-kit
```

### Shared Schema

Define your schema once and import it on both client and server:

```ts
// db/schema.ts
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";

export const feeds = pgTable("feeds", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title"),
  description: text("description"),
  lastFetched: timestamp("last_fetched"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  feedId: integer("feed_id").references(() => feeds.id),
  guid: text("guid").notNull().unique(),
  title: text("title").notNull(),
  url: text("url"),
  content: text("content"),
  publishedAt: timestamp("published_at"),
  readAt: timestamp("read_at"), // null = unread
  starred: boolean("starred").default(false),
  savedAt: timestamp("saved_at"), // null = not saved for offline
});

export const syncQueue = pgTable("sync_queue", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // 'markRead' | 'star' | 'save'
  payload: text("payload").notNull(), // JSON string
  createdAt: timestamp("created_at").defaultNow(),
  syncedAt: timestamp("synced_at"), // null = pending
});
```

### Client DB Composable (PGlite)

```ts
// composables/useClientDb.ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "~/db/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function useClientDb() {
  if (_db) return _db;

  const client = new PGlite("idb://reader-app"); // persists via IndexedDB
  _db = drizzle(client, { schema });

  // Run migrations on first load
  await client.exec(`
    CREATE TABLE IF NOT EXISTS feeds ( ... );
    CREATE TABLE IF NOT EXISTS articles ( ... );
    CREATE TABLE IF NOT EXISTS sync_queue ( ... );
  `);

  return _db;
}
```

> **Tip:** For migrations in PGlite, use `drizzle-kit` to generate SQL migration files,
> then run them via `client.exec()` on startup. Store a schema version in `localStorage`
> to know when to re-run.

### Server DB (Neon)

```ts
// server/db.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "~/db/schema"; // same schema!

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

Switching from Neon to self-hosted Postgres later is a one-line change:

```ts
// Self-hosted / any Postgres provider
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
export const db = drizzle(
  new Pool({ connectionString: process.env.DATABASE_URL }),
);
```

### Querying (same API, client or server)

```ts
// Mark article as read — works identically on client (PGlite) or server (Neon)
await db
  .update(articles)
  .set({ readAt: new Date() })
  .where(eq(articles.id, articleId));

// Fetch unread articles from local DB
const unread = await db.query.articles.findMany({
  where: (a, { isNull }) => isNull(a.readAt),
  orderBy: (a, { desc }) => [desc(a.publishedAt)],
  limit: 50,
});
```

---

## Sync Strategy

Reader apps have a small conflict surface — most actions (mark read, star, save)
are idempotent — making DIY delta sync very viable without a third-party service.

### Sync Queue Pattern

Queue offline mutations locally, flush when back online:

```ts
// composables/useSyncQueue.ts
import { eq, isNull } from "drizzle-orm";

export async function queueAction(
  action: string,
  payload: Record<string, unknown>,
) {
  const db = await useClientDb();
  await db.insert(syncQueue).values({
    action,
    payload: JSON.stringify(payload),
  });
}

export async function flushSyncQueue() {
  const db = await useClientDb();

  const pending = await db.query.syncQueue.findMany({
    where: (q, { isNull }) => isNull(q.syncedAt),
    orderBy: (q, { asc }) => [asc(q.createdAt)],
  });

  for (const item of pending) {
    try {
      await $fetch("/api/sync", {
        method: "POST",
        body: { action: item.action, payload: JSON.parse(item.payload) },
      });
      await db
        .update(syncQueue)
        .set({ syncedAt: new Date() })
        .where(eq(syncQueue.id, item.id));
    } catch {
      // Leave in queue to retry
      break;
    }
  }
}
```

### Trigger Sync on Reconnect

```ts
// plugins/sync.client.ts
export default defineNuxtPlugin(() => {
  window.addEventListener("online", async () => {
    await flushSyncQueue();
  });

  // Also try on app focus (tab switch back)
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      await flushSyncQueue();
    }
  });
});
```

### Server Sync Endpoint

```ts
// server/api/sync.post.ts
import { db } from "~/server/db";
import { articles } from "~/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { action, payload } = await readBody(event);

  switch (action) {
    case "markRead":
      await db
        .update(articles)
        .set({ readAt: new Date(payload.readAt) })
        .where(eq(articles.guid, payload.guid));
      break;

    case "star":
      await db
        .update(articles)
        .set({ starred: payload.starred })
        .where(eq(articles.guid, payload.guid));
      break;

    case "save":
      await db
        .update(articles)
        .set({ savedAt: payload.savedAt ? new Date(payload.savedAt) : null })
        .where(eq(articles.guid, payload.guid));
      break;
  }

  return { ok: true };
});
```

---

## Three-Phase Rollout

### Phase 1 — MVP (Cached Content)

> Goal: Read previously-fetched content offline. No local DB needed yet.

- Install `@vite-pwa/nuxt` and configure workbox caching
- Cache article API responses with `CacheFirst`
- Cache images with `CacheFirst`
- All state (read/unread, stars) lives in Neon only

**Effort:** Low. Gets you 80% of the offline experience immediately.

---

### Phase 2 — Offline State (Local DB)

> Goal: Read/star/save works offline and syncs when back online.

- Add PGlite with `idb://` persistence
- Share Drizzle schema between client and server
- Write mutations to PGlite immediately (optimistic)
- Queue mutations in `sync_queue` table
- Flush queue on reconnect via `window.addEventListener('online', ...)`
- Server sync endpoint applies queued actions to Neon

**Effort:** Medium. The shared schema is the big DX payoff here.

---

### Phase 3 — Full Local-First Polish

> Goal: App feels fully native — instant loads, background sync, download queue.

- **Background Sync API** via Service Worker for reliable queue flushing
  (survives tab close, retries automatically)
- **Delta pull sync**: on login/resume, pull server state newer than last sync
  timestamp and merge into PGlite
- **Podcast/video download queue**: store blob URLs or use the
  [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
  for larger media
- **Conflict resolution**: last-write-wins on `readAt`/`starred` using timestamps
  (sufficient for a reader app)
- Consider **ElectricSQL** (shape-based Postgres sync) as a drop-in upgrade
  to replace the DIY sync queue if complexity grows

```ts
// service-worker.ts — Background Sync registration
self.addEventListener("sync", async (event: SyncEvent) => {
  if (event.tag === "sync-read-state") {
    event.waitUntil(flushSyncQueue());
  }
  if (event.tag === "sync-downloads") {
    event.waitUntil(processDownloadQueue());
  }
});
```

**Effort:** Medium-high. Background Sync and delta pull are the most complex pieces,
but by Phase 3 you have a genuinely native-quality reading experience.

---

## Summary

| Phase | What you get                                 | Key tools                                               |
| ----- | -------------------------------------------- | ------------------------------------------------------- |
| 1     | Offline reading of cached content            | `@vite-pwa/nuxt`, Workbox                               |
| 2     | Offline read/star/save with sync             | PGlite, Drizzle (shared schema), sync queue             |
| 3     | Full local-first, background sync, downloads | Background Sync API, delta pull, ElectricSQL (optional) |

The core advantage of this stack is that **Drizzle + PGlite + Neon all speak PostgreSQL**
— you write your schema and queries once and they run identically on the client and server,
with Neon swappable for any Postgres provider by changing a single import.
