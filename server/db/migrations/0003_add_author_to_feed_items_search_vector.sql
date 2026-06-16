-- Add author and image_url columns to feed_items.
-- author is included in the tsvector search index (weighted lower than title).
-- image_url is stored for display purposes only.
ALTER TABLE "feed_items"
  ADD COLUMN IF NOT EXISTS "author" text,
  ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint

-- Back-fill search_vector for existing rows to include author.
-- Uses weighted vectors: title gets weight A (highest), author gets weight C,
-- content gets weight D (lowest) — matching the trigger below.
UPDATE "feed_items"
SET "search_vector" = (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(author, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'D')
);
--> statement-breakpoint

-- Replace the trigger function to include author in the weighted search vector.
-- title → weight A (highest relevance)
-- author → weight C
-- content → weight D (lowest relevance)
-- Skips recomputation when none of title, author, or content changed.
CREATE OR REPLACE FUNCTION feed_items_search_vector_update()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR
      NEW.title IS DISTINCT FROM OLD.title OR
      NEW.author IS DISTINCT FROM OLD.author OR
      NEW.content IS DISTINCT FROM OLD.content) THEN
    NEW.search_vector := (
      setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW.author, '')), 'C') ||
      setweight(to_tsvector('english', coalesce(NEW.content, '')), 'D')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
