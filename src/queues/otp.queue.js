const Queue = require("bull");

const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    };

const otpQueue = new Queue("otpQueue", {
  redis: redisConfig,
});

module.exports = otpQueue;
