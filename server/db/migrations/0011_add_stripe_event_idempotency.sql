-- Guards the Stripe subscription webhook against duplicate and out-of-order
-- delivery. processed_stripe_events dedups on Stripe's event id so a
-- redelivered event is a no-op; subscriptions.last_stripe_event_at blocks an
-- older event from overwriting state a newer one already wrote. See
-- server/utils/subscriptions.ts (upsertSubscriptionFromStripe, isStaleEvent).
CREATE TABLE "processed_stripe_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "processed_stripe_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_stripe_event_at" timestamp;--> statement-breakpoint
CREATE INDEX "processed_stripe_events_processed_at_idx" ON "processed_stripe_events" USING btree ("processed_at");