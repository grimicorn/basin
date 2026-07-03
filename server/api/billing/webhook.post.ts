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
  if (!signature) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing Stripe-Signature header",
    });
  }

  const rawBody = await readRawBody(event);
  if (!rawBody) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing request body",
    });
  }

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = verifyWebhookSignature(rawBody, signature);
  } catch (caughtError) {
    // A missing Stripe secret is a server misconfiguration (verifyWebhookSignature
    // throws a 500 for that), not a bad signature — let it propagate as a 5xx so
    // it pages ops and Stripe retries, instead of masking it as a permanent 400
    // "invalid signature" that Stripe won't retry. Only an actual signature
    // mismatch (an unrecognized error) should be reported as a 400.
    if (isError(caughtError) && caughtError.statusCode >= 500) {
      throw caughtError;
    }
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
