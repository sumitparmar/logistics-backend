const Redis = require("ioredis");

const redisOptions = {
  keyPrefix: "movekart:",
  connectTimeout: 10000,

  maxRetriesPerRequest: null,
  enableReadyCheck: true,

  retryStrategy: (times) => {
    return Math.min(times * 50, 2000);
  },
};

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, redisOptions)
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      ...redisOptions,
    });

redis.on("connect", () => {});

redis.on("error", (err) => {
  console.error("[REDIS] Error:", err.message);
});

module.exports = redis;
