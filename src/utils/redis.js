const { createClient } = require("redis");
const { logger } = require("./logger");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let client;
let connectPromise;

async function getRedisClient() {
  if (client && client.isOpen) {
    return client;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    try {
      const newClient = createClient({ url: REDIS_URL });
      newClient.on("error", (err) => {
        logger.error("Redis client error", { error: err.message });
      });
      await newClient.connect();
      client = newClient;
      return client;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

module.exports = { getRedisClient };
