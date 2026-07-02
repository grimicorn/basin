import type Stripe from "stripe";
import { verifyWebhookSignature } from "../../utils/stripe";
import { upsertSubscriptionFromStripe } from "../../utils/subscriptions";

// Stripe fires many event types; we only need to react to subscription
// lifecycle changes to keep our local plan/status in sync. Listening to the
// subscription events (rather than checkout.session.completed) also covers
// renewals, trial-to-paid conversions, and cancellations with one handler.
const SUBSCRIPTION_EVENT_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export default defineEventHandler(async (event) => {
  const signature = getHeader(event, "stripe-signature");
  if (!signature)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing Stripe-Signature header",
    });

  const rawBody = await readRawBody(event);
  if (!rawBody)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing request body",
    });

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = verifyWebhookSignature(rawBody, signature);
  } catch {
    // Never trust an unverified payload: reject rather than parse it.
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Stripe webhook signature",
    });
  }

  if (SUBSCRIPTION_EVENT_TYPES.has(stripeEvent.type)) {
    await upsertSubscriptionFromStripe(
      stripeEvent.data.object as Stripe.Subscription,
    );
  }

  return { received: true };
});
