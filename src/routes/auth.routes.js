const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { otpLimiter, authLimiter } = require("../middlewares/rateLimiter");
const validate = require("../middlewares/validate.middleware");

const {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
} = require("../validators/auth.validator");

// OTP Routes
router.post(
  "/send-otp",
  otpLimiter,
  validate(sendOtpSchema),
  authController.sendOtpController,
);

router.post(
  "/verify-otp",
  otpLimiter,
  validate(verifyOtpSchema),
  authController.verifyOtpController,
);

// Auth Routes
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  authController.register,
);

router.post("/login", authLimiter, validate(loginSchema), authController.login);

module.exports = router;
