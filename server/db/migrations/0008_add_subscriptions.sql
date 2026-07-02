-- Persists Stripe billing state per user for the Pro plan.
-- plan: "free" | "pro" (derived from status below by the webhook handler).
-- status mirrors the Stripe subscription status ("trialing", "active",
-- "past_due", "canceled", etc.); "none" before a subscription is created.
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
	"stripe_customer_id" text NOT NULL UNIQUE,
	"stripe_subscription_id" text UNIQUE,
	"stripe_price_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'none' NOT NULL,
	"current_period_end" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
