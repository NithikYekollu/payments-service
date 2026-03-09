const { getRedisClient } = require("../utils/redis");
const { logger } = require("../utils/logger");

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const KEY_PREFIX = "idempotency:";

/**
 * Express middleware that provides idempotency key support.
 *
 * When a request includes an `Idempotency-Key` header, the middleware checks
 * Redis for a cached response. If found, it returns the cached response
 * immediately. Otherwise, it intercepts the response, caches it in Redis
 * with a 24-hour TTL, and sends it to the client.
 *
 * Requests without an `Idempotency-Key` header pass through unchanged.
 */
function idempotency() {
  return async (req, res, next) => {
    const idempotencyKey = req.headers["idempotency-key"];

    if (!idempotencyKey) {
      return next();
    }

    const redisKey = `${KEY_PREFIX}${idempotencyKey}`;

    try {
      const redisClient = await getRedisClient();
      const cached = await redisClient.get(redisKey);

      if (cached) {
        const { statusCode, body } = JSON.parse(cached);
        logger.info("Returning cached idempotent response", { idempotencyKey });
        return res.status(statusCode).json(body);
      }

      // Intercept res.json to capture the response for caching
      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        try {
          const entry = JSON.stringify({ statusCode: res.statusCode, body });
          await redisClient.set(redisKey, entry, { EX: IDEMPOTENCY_TTL_SECONDS });
          logger.info("Cached idempotent response", { idempotencyKey });
        } catch (cacheErr) {
          logger.error("Failed to cache idempotent response", {
            idempotencyKey,
            error: cacheErr.message,
          });
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      // If Redis is unavailable, proceed without idempotency to avoid blocking transfers
      logger.error("Idempotency middleware Redis error, proceeding without cache", {
        idempotencyKey,
        error: err.message,
      });
      next();
    }
  };
}

module.exports = { idempotency };
