const { logger } = require("../utils/logger");

// In-memory audit log store (capped to prevent unbounded growth)
const MAX_AUDIT_LOG_SIZE = 10000;
const auditLog = [];

/**
 * Derive a structured action_type from the HTTP method and route path.
 * Examples: "payment.created", "refund.initiated", "transfer.created"
 */
function deriveActionType(method, path) {
  // Normalise: strip /api/v1/ prefix, query strings, and trailing slashes
  const normalized = path.replace(/^\/api\/v1\//, "").replace(/\?.*$/, "").replace(/\/$/, "");
  const segment = normalized.split("/")[0];

  const resourceMap = {
    payments: "payment",
    refunds: "refund",
    transfers: "transfer",
    ledger: "ledger",
    webhooks: "webhook",
  };

  const resource = resourceMap[segment] || segment;

  const methodActionMap = {
    POST: "created",
    GET: "retrieved",
    PUT: "updated",
    PATCH: "updated",
    DELETE: "deleted",
  };

  const action = methodActionMap[method.toUpperCase()] || "accessed";

  // Special cases
  if (resource === "refund" && method.toUpperCase() === "POST") {
    return "refund.initiated";
  }
  if (resource === "ledger" && normalized.includes("reconcile")) {
    return "ledger.reconciled";
  }
  if (resource === "ledger" && normalized.includes("balance")) {
    return "ledger.balance_retrieved";
  }

  return `${resource}.${action}`;
}

/**
 * Audit middleware that captures request metadata and response data
 * to produce structured audit entries for compliance.
 */
function auditMiddleware(req, res, next) {
  const timestamp = new Date().toISOString();
  const actor = req.user
    ? req.user.sub || req.user.id || req.user.email || JSON.stringify(req.user)
    : "anonymous";
  const ipAddress = req.ip || req.connection?.remoteAddress || "unknown";

  // Intercept res.json to capture the response body
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const actionType = deriveActionType(req.method, req.originalUrl || req.url);
    const transactionId = body?.id || req.params?.id || req.query?.transaction_id || null;
    const amount = body?.amount ?? req.body?.amount ?? null;

    const entry = {
      timestamp,
      actor,
      ip_address: ipAddress,
      action_type: actionType,
      transaction_id: transactionId,
      amount,
      method: req.method,
      path: req.originalUrl || req.url,
      status_code: res.statusCode,
    };

    auditLog.push(entry);
    if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
      auditLog.shift();
    }

    logger.info("Audit entry recorded", entry);

    return originalJson(body);
  };

  next();
}

/**
 * Retrieve audit log entries, optionally filtered by transaction_id.
 */
function getAuditEntries(filters = {}) {
  let entries = [...auditLog];
  if (filters.transaction_id) {
    entries = entries.filter((e) => e.transaction_id === filters.transaction_id);
  }
  return entries;
}

/**
 * Clear the audit log (useful for testing).
 */
function clearAuditLog() {
  auditLog.length = 0;
}

module.exports = { auditMiddleware, getAuditEntries, clearAuditLog, deriveActionType };
