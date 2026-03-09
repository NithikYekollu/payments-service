const { logger } = require("../utils/logger");

function errorHandler(err, req, res, next) {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Only show detailed errors in development
  const isDev = process.env.NODE_ENV === "development";
  const message = isDev ? err.message : "Internal server error";

  res.status(err.statusCode || 500).json({
    error: message,
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
