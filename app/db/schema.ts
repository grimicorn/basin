import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Client-side PGlite schema — feeds, feedItems, and syncQueue only.
// Users/integrations/userSettings live in Neon only.
// No FK references: PGlite is a local single-user store, no cross-table enforcement needed.

export const feeds = pgTable(
  "feeds",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    lastFetched: timestamp("last_fetched"),
    source: text("source").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [uniqueIndex("feeds_user_id_url_idx").on(table.userId, table.url)],
);

export const feedItems = pgTable(
  "feed_items",
  {
    id: serial("id").primaryKey(),
    feedId: integer("feed_id").notNull(),
    guid: text("guid").notNull().unique(),
    title: text("title").notNull(),
    url: text("url"),
    content: text("content"),
    tags: text("tags").array(),
    publishedAt: timestamp("published_at"),
    readAt: timestamp("read_at"),
    starred: boolean("starred").default(false),
    savedAt: timestamp("saved_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("feed_items_tags_gin_idx").using("gin", table.tags)],
);

export const syncQueue = pgTable("sync_queue", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  syncedAt: timestamp("synced_at"),
});

export const feedsRelations = relations(feeds, ({ many }) => ({
  items: many(feedItems),
}));

export const feedItemsRelations = relations(feedItems, ({ one }) => ({
  feed: one(feeds, { fields: [feedItems.feedId], references: [feeds.id] }),
}));
