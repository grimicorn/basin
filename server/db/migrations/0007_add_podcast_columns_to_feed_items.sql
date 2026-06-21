-- Add podcast-specific columns to feed_items.
-- media_url  — URL of the audio/video enclosure.
-- media_duration — episode duration in seconds (integer); NULL for non-podcast items.
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "media_url" text;
--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "media_duration" integer;
