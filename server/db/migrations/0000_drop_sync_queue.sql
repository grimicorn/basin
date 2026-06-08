-- sync_queue belongs in PGlite (client-side offline store) only, not Neon.
-- Run this if the table was previously pushed to Neon via `db:push`.
DROP TABLE IF EXISTS "sync_queue";
