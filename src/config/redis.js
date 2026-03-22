const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log("[REDIS] Connected");
});

redis.on("error", (err) => {
  console.error("[REDIS] Error:", err.message);
});

module.exports = redis;
