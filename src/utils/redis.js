const { createClient } = require("redis");
const { logger } = require("./logger");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let client;

async function getRedisClient() {
  if (client && client.isOpen) {
    return client;
  }

  client = createClient({ url: REDIS_URL });

  client.on("error", (err) => {
    logger.error("Redis client error", { error: err.message });
  });

  await client.connect();
  return client;
}

module.exports = { getRedisClient };
