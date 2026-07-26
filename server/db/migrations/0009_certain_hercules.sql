ALTER TABLE "feeds" ADD COLUMN "sync_status" text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "sync_failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "sync_status" text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "sync_failed_at" timestamp;