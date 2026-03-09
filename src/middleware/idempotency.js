const { getRedisClient } = require("../utils/redis");
const { logger } = require("../utils/logger");

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const LOCK_TTL_SECONDS = 30; // Lock timeout for in-flight requests
const KEY_PREFIX = "idempotency:";

/**
 * Express middleware that provides idempotency key support.
 *
 * When a request includes an `Idempotency-Key` header, the middleware checks
 * Redis for a cached response. If found, it returns the cached response
 * immediately. Otherwise, it acquires a lock, intercepts the response, caches
 * it in Redis with a 24-hour TTL, and sends it to the client.
 *
 * Keys are scoped per authenticated user to prevent cross-user collisions.
 * Only successful (2xx) responses are cached to allow retries on failures.
 *
 * Requests without an `Idempotency-Key` header pass through unchanged.
 */
function idempotency() {
  return async (req, res, next) => {
    const idempotencyKey = req.headers["idempotency-key"];

    if (!idempotencyKey) {
      return next();
    }

    // Scope key to the authenticated user to prevent cross-user collisions
    const userId = req.user?.sub || req.user?.id || "anonymous";
    const redisKey = `${KEY_PREFIX}${userId}:${idempotencyKey}`;
    const lockKey = `${redisKey}:lock`;

    try {
      const redisClient = await getRedisClient();
      const cached = await redisClient.get(redisKey);

      if (cached) {
        const { statusCode, body } = JSON.parse(cached);
        logger.info("Returning cached idempotent response", { idempotencyKey });
        return res.status(statusCode).json(body);
      }

      // Acquire a lock to prevent concurrent duplicate processing
      const lockAcquired = await redisClient.set(lockKey, "processing", {
        NX: true,
        EX: LOCK_TTL_SECONDS,
      });

      if (!lockAcquired) {
        return res.status(409).json({ error: "A request with this idempotency key is already being processed" });
      }

      // Intercept res.json to capture the response for caching
      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        try {
          // Only cache successful responses so transient errors can be retried
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const entry = JSON.stringify({ statusCode: res.statusCode, body });
            await redisClient.set(redisKey, entry, { EX: IDEMPOTENCY_TTL_SECONDS });
            logger.info("Cached idempotent response", { idempotencyKey });
          }
          // Release the lock after processing
          await redisClient.del(lockKey);
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
