-- Ensure a unique constraint exists on feed_items.guid.
-- The column carries .unique() in the Drizzle schema, which db:push applies
-- automatically, but the migration runner used by the e2e global-setup only
-- applies SQL in this migrations folder. Without this migration, any Neon
-- branch bootstrapped solely via migrations will be missing the constraint,
-- causing ON CONFLICT (guid) to fail with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- We use CREATE UNIQUE INDEX IF NOT EXISTS rather than ALTER TABLE ADD CONSTRAINT
-- because PostgreSQL has no "ADD CONSTRAINT IF NOT EXISTS" syntax. A unique index
-- satisfies ON CONFLICT (guid) in the same way a unique constraint does.
CREATE UNIQUE INDEX IF NOT EXISTS "feed_items_guid_unique"
  ON "feed_items" ("guid");
