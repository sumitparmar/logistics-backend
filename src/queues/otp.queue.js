const Queue = require("bull");

const otpQueue = new Queue("otpQueue", process.env.REDIS_URL);

module.exports = otpQueue;
