-- Add author and image_url to feed_items for RSS adapter mapping.
ALTER TABLE "feed_items"
  ADD COLUMN IF NOT EXISTS "author" text,
  ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint

-- Track when a feed was last successfully synced so the debounce guard
-- and the scheduler can determine which feeds are due for a refresh.
ALTER TABLE "feeds"
  ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp;
--> statement-breakpoint

-- Drop the existing broad unique constraint on guid (globally unique) and
-- replace it with a per-feed unique constraint on (feed_id, guid).
-- This allows different feeds to have items with the same guid while still
-- preventing duplicates within a single feed — which is the idempotency
-- guarantee retries rely on.
ALTER TABLE "feed_items"
  DROP CONSTRAINT IF EXISTS "feed_items_guid_unique";
--> statement-breakpoint

ALTER TABLE "feed_items"
  ADD CONSTRAINT "feed_items_feed_id_guid_unique"
  UNIQUE ("feed_id", "guid");
--> statement-breakpoint

-- Index on last_synced_at so the scheduler can efficiently find feeds due for
-- a refresh without a full table scan.
CREATE INDEX IF NOT EXISTS "feeds_last_synced_at_idx"
  ON "feeds" ("last_synced_at");
