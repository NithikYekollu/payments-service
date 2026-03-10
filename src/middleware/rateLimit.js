const rateLimit = require("express-rate-limit");
const config = require("../../config/default.json");
const { logger } = require("../utils/logger");

const rateLimitConfig = config.rateLimit;

const apiRateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use authenticated user identity if available, otherwise fall back to IP
    return req.user?.sub || req.ip;
  },
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      user: req.user?.sub,
    });
    res.status(429).json({ error: "Too many requests, please try again later" });
  },
  validate: { xForwardedForHeader: false, default: true },
});

module.exports = { apiRateLimiter };
