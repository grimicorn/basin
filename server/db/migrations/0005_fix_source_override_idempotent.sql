-- Re-apply the source_override column addition with IF NOT EXISTS.
-- This is a safety net for cases where migration 0004 was recorded as applied
-- in __drizzle_migrations but the ALTER TABLE did not actually execute (e.g.
-- due to a failed e2e run that left the migration tracking table in an
-- inconsistent state on the shared Neon branch).
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "source_override" text;
