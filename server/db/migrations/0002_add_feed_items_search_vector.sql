-- Add a tsvector column to feed_items for full-text search.
-- The column is populated by a trigger so it stays in sync whenever a row is
-- inserted or updated, avoiding stale data from a generated-column approach
-- (Neon / standard PG support STORED generated columns only for immutable
-- functions, and tsvector population uses coalesce which is stable, not immutable).

ALTER TABLE "feed_items"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
--> statement-breakpoint

-- Back-fill existing rows.
UPDATE "feed_items"
SET "search_vector" = to_tsvector(
  'english',
  coalesce(title, '') || ' ' || coalesce(content, '')
);
--> statement-breakpoint

-- GIN index for fast full-text lookups.
CREATE INDEX IF NOT EXISTS "feed_items_search_vector_gin_idx"
  ON "feed_items" USING gin ("search_vector");
--> statement-breakpoint

-- Trigger function that keeps search_vector up to date on every write.
-- Skips recomputation when neither title nor content changed (e.g. updating
-- readAt or starred), using IS DISTINCT FROM to handle NULLs correctly.
CREATE OR REPLACE FUNCTION feed_items_search_vector_update()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR
      NEW.title IS DISTINCT FROM OLD.title OR
      NEW.content IS DISTINCT FROM OLD.content) THEN
    NEW.search_vector := to_tsvector(
      'english',
      coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, '')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS feed_items_search_vector_trigger ON "feed_items";
--> statement-breakpoint

CREATE TRIGGER feed_items_search_vector_trigger
BEFORE INSERT OR UPDATE ON "feed_items"
FOR EACH ROW EXECUTE FUNCTION feed_items_search_vector_update();
