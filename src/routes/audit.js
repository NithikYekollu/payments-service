const express = require("express");
const { getAuditEntries } = require("../middleware/audit");

const router = express.Router();

/**
 * GET /api/v1/audit
 * Returns audit log entries. Supports filtering by transaction_id query param.
 */
router.get("/", (req, res) => {
  const filters = {};
  if (req.query.transaction_id) {
    filters.transaction_id = req.query.transaction_id;
  }
  const entries = getAuditEntries(filters);
  res.json({ entries, total: entries.length });
});

module.exports = router;
