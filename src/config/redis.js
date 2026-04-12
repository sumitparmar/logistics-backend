const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD || undefined,

  keyPrefix: "movekart:",
  connectTimeout: 10000,

  maxRetriesPerRequest: null,
  enableReadyCheck: true,

  retryStrategy: (times) => {
    return Math.min(times * 50, 2000);
  },
});

redis.on("connect", () => {});

redis.on("error", (err) => {
  console.error("[REDIS] Error:", err.message);
});

module.exports = redis;
