import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Drizzle does not ship a first-class tsvector type yet, so we define a
// passthrough custom type. The column is populated and maintained by a
// database trigger (see migration 0001_add_feed_items_search_vector.sql) —
// Drizzle never writes to it directly.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  providerId: text("provider_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const feeds = pgTable(
  "feeds",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    feedId: integer("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
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
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    index("feed_items_tags_gin_idx").using("gin", table.tags),
    index("feed_items_search_vector_gin_idx").using("gin", table.searchVector),
  ],
);

export const integrations = pgTable(
  "integrations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenSecret: text("token_secret"),
    expiresAt: timestamp("expires_at"),
    scopes: text("scopes").array(),
    providerAccountId: text("provider_account_id"),
    providerUsername: text("provider_username"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("integrations_user_id_provider_idx").on(
      table.userId,
      table.provider,
    ),
  ],
);

export const userSettings = pgTable("user_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  showUnreadOnly: boolean("show_unread_only").notNull().default(false),
  autoplayMediaPreviews: boolean("autoplay_media_previews")
    .notNull()
    .default(false),
  compactNotifications: boolean("compact_notifications")
    .notNull()
    .default(false),
  theme: text("theme").notNull().default("system"),
  accentColor: text("accent_color").notNull().default("violet"),
  readingFont: text("reading_font").notNull().default("serif"),
  spacing: text("spacing").notNull().default("cozy"),
  radius: text("radius").notNull().default("sharp"),
  layout: text("layout").notNull().default("timeline"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  feeds: many(feeds),
  integrations: many(integrations),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  user: one(users, { fields: [feeds.userId], references: [users.id] }),
  items: many(feedItems),
}));

export const feedItemsRelations = relations(feedItems, ({ one }) => ({
  feed: one(feeds, { fields: [feedItems.feedId], references: [feeds.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  user: one(users, { fields: [integrations.userId], references: [users.id] }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));
