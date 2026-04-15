const authService = require("../services/auth.service");
const { sendOtp, verifyOtp } = require("../services/auth.service");
const { sendSuccess, sendError } = require("../utils/response");
const { verifyEmail } = require("../services/auth.service");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");

// REGISTER

const register = async (req, res, next) => {
  try {
    const payload = { ...req.body };

    payload.role = "user";

    if (req.body.role === "admin") {
      if (!req.user || req.user.role !== "admin") {
        return sendError(res, "Not allowed to create admin", 403);
      }

      payload.role = "admin";
    }

    const result = await authService.registerUser(payload);

    return sendSuccess(res, result, "User registered", 201);
  } catch (error) {
    next(error);
  }
};

// LOGIN

const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);

    return sendSuccess(res, result, "Login successful");
  } catch (error) {
    next(error);
  }
};

// SEND OTP

const sendOtpController = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return sendError(res, "Phone number required", 400);
    }

    const result = await sendOtp(phone);

    return sendSuccess(res, result, "OTP sent");
  } catch (error) {
    next(error);
  }
};

// VERIFY OTP

const verifyOtpController = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return sendError(res, "Phone and OTP required", 400);
    }

    const result = await verifyOtp(phone, otp);

    return sendSuccess(res, result, "OTP verified");
  } catch (error) {
    next(error);
  }
};

const verifyEmailController = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/login?verified=false`,
      );
    }

    await verifyEmail(token);

    return res.redirect(`${process.env.FRONTEND_URL}/auth/login?verified=true`);
  } catch (error) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/login?verified=false`,
    );
  }
};

const User = require("../models/User");

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const updates = {
      name: req.body.name,
      phone: req.body.phone,
      businessName: req.body.businessName,

      ...(req.body.deliveryMode && { deliveryMode: req.body.deliveryMode }),
    };

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
    }).select("-password");

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

const bcrypt = require("bcryptjs");

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    const match = await bcrypt.compare(currentPassword, user.password);

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Current password incorrect",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    user.password = hashed;

    await user.save();

    res.json({
      success: true,
      message: "Password updated",
    });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, "Email is required", 400);
    }

    const user = await User.findOne({ email });

    // Always return success (security best practice)
    if (!user) {
      return sendSuccess(res, {}, "If email exists, reset link sent");
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash token before saving (security)
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 mins

    await user.save();
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

    const html = `
  <h2>Password Reset Request</h2>
  <p>You requested to reset your password.</p>
  <p>Click below link to reset:</p>
  <a href="${resetUrl}" target="_blank">${resetUrl}</a>
  <p>This link will expire in 10 minutes.</p>
`;

    await sendEmail(user.email, "Reset Your Password", html);
    return sendSuccess(res, {}, "If email exists, reset link sent");
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return sendError(res, "Token and password required", 400);
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return sendError(res, "Invalid or expired token", 400);
    }

    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return sendSuccess(res, {}, "Password reset successful");
  } catch (error) {
    next(error);
  }
};
// EXPORTS

module.exports = {
  register,
  login,
  sendOtpController,
  verifyOtpController,
  verifyEmailController,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
