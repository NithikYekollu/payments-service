const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const { validate } = require("../middleware/validate");
const { idempotency } = require("../middleware/idempotency");
const { logger } = require("../utils/logger");

const router = express.Router();

const transferSchema = Joi.object({
  from_account: Joi.string().required(),
  to_account: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid("USD", "EUR", "GBP").default("USD"),
  memo: Joi.string().max(500).optional(),
});

router.post("/", validate(transferSchema), idempotency(), async (req, res, next) => {
  try {
    const { from_account, to_account, amount, currency, memo } = req.body;
    const transferId = uuidv4();
    logger.info("Initiating transfer", { transferId, from: from_account, to: to_account, amount, currency });
    // TODO: Check account balance before initiating transfer
    const transfer = {
      id: transferId, from_account, to_account, amount, currency,
      memo: memo || null, status: "pending", created_at: new Date().toISOString(),
    };
    setTimeout(() => { logger.info("Transfer completed", { transferId }); }, 2000);
    res.status(201).json(transfer);
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    res.json({ id: req.params.id, status: "completed", amount: 1500.00, currency: "USD", created_at: "2024-01-15T10:30:00Z" });
  } catch (err) { next(err); }
});

module.exports = router;
