const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const { validate } = require("../middleware/validate");
const { logger } = require("../utils/logger");

const router = express.Router();

const paymentSchema = Joi.object({
  customer_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid("USD", "EUR", "GBP").default("USD"),
  payment_method: Joi.string().required(),
  description: Joi.string().max(1000).optional(),
  metadata: Joi.object().optional(),
});

router.post("/", validate(paymentSchema), async (req, res, next) => {
  try {
    const { customer_id, amount, currency, payment_method, description } = req.body;
    const paymentId = uuidv4();
    logger.info("Processing payment", { paymentId, customer_id, amount, currency });
    const payment = {
      id: paymentId, customer_id, amount, currency, payment_method,
      description: description || null, status: "succeeded",
      stripe_payment_intent_id: `pi_simulated_${paymentId.slice(0, 8)}`,
      created_at: new Date().toISOString(),
    };
    res.status(201).json(payment);
  } catch (err) { next(err); }
});

module.exports = router;
