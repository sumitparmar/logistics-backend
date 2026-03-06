const authService = require("../services/auth.service");
const { sendOtp, verifyOtp } = require("../services/auth.service");
const { sendSuccess, sendError } = require("../utils/response");
const { verifyEmail } = require("../services/auth.service");
// REGISTER

const register = async (req, res, next) => {
  try {
    const token = await authService.registerUser(req.body);

    return sendSuccess(res, { token }, "User registered", 201);
  } catch (error) {
    next(error);
  }
};

// LOGIN

const login = async (req, res, next) => {
  try {
    const token = await authService.loginUser(req.body);

    return sendSuccess(res, { token }, "Login successful");
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

const verifyEmailController = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return sendError(res, "Verification token required", 400);
    }

    await verifyEmail(token);

    return res.redirect(`${process.env.FRONTEND_URL}/auth/login?verified=true`);
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
};
