const { logger } = require("../utils/logger");

function errorHandler(err, req, res, next) {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Don't leak stack traces in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  res.status(err.statusCode || 500).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
