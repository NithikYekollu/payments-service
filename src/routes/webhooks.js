const express = require("express");
const { logger } = require("../utils/logger");

const router = express.Router();

const MAX_RETRIES = parseInt(process.env.WEBHOOK_RETRY_MAX || "5", 10);
const RETRY_DELAY_MS = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || "1000", 10);

// BUG: Webhook signature verification is commented out
// BUG: Retry logic uses fixed delay instead of exponential backoff
// BUG: Failed webhook processing is silently swallowed
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    // TODO: Verify webhook signature
    // const sig = req.headers["stripe-signature"];
    // event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (err) {
    logger.error("Webhook signature verification failed", { error: err.message });
    return res.status(400).json({ error: "Invalid signature" });
  }

  logger.info("Received webhook event", { type: event.type, id: event.id });

  let processed = false;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await processWebhookEvent(event);
      processed = true;
      break;
    } catch (err) {
      logger.warn(`Webhook processing attempt ${attempt} failed`, { eventId: event.id, error: err.message });
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  if (!processed) {
    logger.error("Webhook processing failed after all retries", { eventId: event.id });
  }

  res.status(200).json({ received: true });
});

async function processWebhookEvent(event) {
  switch (event.type) {
    case "payment_intent.succeeded":
      logger.info("Payment succeeded", { paymentIntent: event.data?.object?.id });
      break;
    case "payment_intent.payment_failed":
      logger.warn("Payment failed", { paymentIntent: event.data?.object?.id });
      break;
    case "charge.refunded":
      logger.info("Charge refunded", { charge: event.data?.object?.id });
      break;
    default:
      logger.debug("Unhandled event type", { type: event.type });
  }
}

module.exports = router;
