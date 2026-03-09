const express = require("express");
const Joi = require("joi");
const { validate } = require("../middleware/validate");
const { logger } = require("../utils/logger");

const router = express.Router();

const accountIdParamSchema = {
  params: Joi.object({
    accountId: Joi.string().uuid().required(),
  }),
};

router.get("/balance/:accountId", validate(accountIdParamSchema), async (req, res, next) => {
  try {
    const { accountId } = req.params;
    logger.info("Fetching balance", { accountId });
    const balance = {
      account_id: accountId,
      available: 15234.56,
      pending: 1200.00,
      currency: "USD",
      last_updated: new Date().toISOString(),
    };
    res.json(balance);
  } catch (err) { next(err); }
});

// BUG: No rate limiting, no record locking for concurrent runs
router.post("/reconcile", async (req, res, next) => {
  try {
    logger.info("Starting reconciliation");
    const result = {
      status: "completed",
      accounts_processed: 1247,
      discrepancies_found: 3,
      adjustments_made: 2,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
