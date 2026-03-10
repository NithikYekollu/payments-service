const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const { validate } = require("../middleware/validate");
const { logger } = require("../utils/logger");
const { getPayment, getRefunds, saveRefund } = require("../utils/store");

const router = express.Router();

const refundSchema = Joi.object({
  payment_id: Joi.string().required(),
  amount: Joi.number().positive().optional(),
  reason: Joi.string().valid("duplicate", "fraudulent", "requested_by_customer").required(),
});

router.post("/", validate(refundSchema), async (req, res, next) => {
  try {
    const { payment_id, amount, reason } = req.body;

    // Look up the original payment
    const payment = getPayment(payment_id);
    if (!payment) {
      return res.status(400).json({ error: `Payment ${payment_id} not found` });
    }

    // Determine refund amount (default to full payment amount)
    const refundAmount = amount || payment.amount;

    // Use integer cents to avoid floating-point precision errors
    const toCents = (n) => Math.round(n * 100);
    const paymentCents = toCents(payment.amount);
    const refundCents = toCents(refundAmount);

    // Retrieve previous refunds for this payment
    const previousRefunds = getRefunds(payment_id);
    const totalRefundedCents = previousRefunds.reduce((sum, r) => sum + toCents(r.amount), 0);

    // Duplicate detection: reject if payment has already been fully refunded
    if (totalRefundedCents >= paymentCents) {
      return res.status(409).json({
        error: "Payment has already been fully refunded",
        payment_id,
      });
    }

    // Validate that the refund amount does not exceed the original payment
    if (refundCents > paymentCents) {
      return res.status(400).json({
        error: `Refund amount ($${refundAmount}) exceeds original payment amount ($${payment.amount})`,
        payment_id,
      });
    }

    // Validate that cumulative refunds do not exceed original payment
    if (totalRefundedCents + refundCents > paymentCents) {
      const remaining = (paymentCents - totalRefundedCents) / 100;
      return res.status(400).json({
        error: `Refund amount ($${refundAmount}) exceeds remaining refundable amount ($${remaining})`,
        payment_id,
      });
    }

    const refundId = uuidv4();
    logger.info("Processing refund", { refundId, payment_id, amount: refundAmount, reason });
    const refund = {
      id: refundId, payment_id, amount: refundAmount, reason,
      status: "succeeded", created_at: new Date().toISOString(),
    };
    saveRefund(refund);
    res.status(201).json(refund);
  } catch (err) { next(err); }
});

module.exports = router;
