const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { otpLimiter, authLimiter } = require("../middlewares/rateLimiter");
const validate = require("../middlewares/validate.middleware");
const protect = require("../middlewares/auth.middleware");
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
router.get("/verify-email", authController.verifyEmailController);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", protect, authController.getProfile);
router.put("/profile", protect, authController.updateProfile);
router.put("/profile-photo", protect, authController.updateProfilePhoto);
router.post("/change-password", protect, authController.changePassword);
module.exports = router;
