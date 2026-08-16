const rateLimit = require("express-rate-limit");

// OTP endpoints
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: {
    success: false,
    message: "Too many OTP requests. Try again later.",
  },
});

// Login/Register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many authentication attempts. Try again later.",
  },
});

// Order creation
const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Too many order requests. Slow down.",
  },
});

const invoiceResendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many invoice email requests. Try again later.",
  },
});

module.exports = {
  otpLimiter,
  authLimiter,
  orderLimiter,
  invoiceResendLimiter,
};
