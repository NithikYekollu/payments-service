const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const { validate } = require("../middleware/validate");
const { logger } = require("../utils/logger");

const router = express.Router();

const refundSchema = Joi.object({
  payment_id: Joi.string().required(),
  amount: Joi.number().positive().optional(),
  reason: Joi.string().valid("duplicate", "fraudulent", "requested_by_customer").required(),
});

// BUG: Refund amount is not checked against the original payment amount.
router.post("/", validate(refundSchema), async (req, res, next) => {
  try {
    const { payment_id, amount, reason } = req.body;
    const refundId = uuidv4();
    logger.info("Processing refund", { refundId, payment_id, amount, reason });
    const refund = {
      id: refundId, payment_id, amount: amount || null, reason,
      status: "succeeded", created_at: new Date().toISOString(),
    };
    res.status(201).json(refund);
  } catch (err) { next(err); }
});

module.exports = router;
