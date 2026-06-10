const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
// const Otp = require("../models/Otp");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const redis = require("../config/redis");
const otpQueue = require("../queues/otp.queue");

const getEmailVerificationUrl = (token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "https://movekart.in").replace(
    /\/+$/,
    "",
  );
  const apiUrl = (
    process.env.PUBLIC_API_URL ||
    process.env.API_BASE_URL ||
    `${frontendUrl}/api`
  ).replace(/\/+$/, "");

  return `${apiUrl}/auth/verify-email?token=${token}`;
};

const registerUser = async (data) => {
  const { name, email, phone, password, role } = data;

  const existingUser = await User.findOne({
    $or: [{ email }, { phone }],
  });

  if (existingUser) {
    if (!existingUser.isActive) {
      throw new Error("Account exists but is deactivated. Contact support.");
    }

    if (existingUser.isEmailVerified) {
      throw new Error("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    existingUser.name = name;
    existingUser.email = email;
    existingUser.phone = phone;
    existingUser.password = hashedPassword;
    existingUser.emailVerificationToken = verificationToken;
    existingUser.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    await existingUser.save();

    const verificationUrl = getEmailVerificationUrl(verificationToken);
    await sendEmail(
      existingUser.email,
      "Verify your email - MoveKart Logistics",
      `
    <h3>Welcome to MoveKart Logistics</h3>
    <p>Please verify your email by clicking the link below:</p>
    <a href="${verificationUrl}">${verificationUrl}</a>
    <p>This link expires in 24 hours.</p>
  `,
    );

    return generateToken(existingUser);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const verificationToken = crypto.randomBytes(32).toString("hex");

  const user = await User.create({
    name,
    email,
    phone,
    password: hashedPassword,
    role: role || "user",
    authProvider: "email",
    isEmailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000,
  });

  const verificationUrl = getEmailVerificationUrl(verificationToken);
  await sendEmail(
    user.email,
    "Verify your email - MoveKart Logistics",
    `
    <h3>Welcome to MoveKart Logistics</h3>
    <p>Please verify your email by clicking the link below:</p>
    <a href="${verificationUrl}">${verificationUrl}</a>
    <p>This link expires in 24 hours.</p>
  `,
  );
  return generateToken(user);
};

const loginUser = async (data) => {
  const { email, password, phone, otp } = data;

  if (email && password) {
    let user = await User.findOne({ email })
      .select("+password")
      .populate("adminRole");

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Safe revive logic (no break)
    if (!user.isActive) {
      throw new Error("Your account has been deactivated. Contact support.");
    }

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    if (user.authProvider === "email" && !user.isEmailVerified) {
      throw new Error("Please verify your email before logging in.");
    }

    return generateToken(user);
  }

  if (phone && otp) {
    return await verifyOtp(phone, otp);
  }

  throw new Error("Invalid login method");
};

const generateToken = (user) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN },
  );

  const adminRole = user.adminRole && {
    id: user.adminRole._id || user.adminRole,
    name: user.adminRole.name,
  };

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      deliveryMode: user.deliveryMode || null,
      adminRole,
      permissions: user.adminRole?.permissions || [],
    },
  };
};

const sendOtp = async (phone, fallbackEmail) => {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  const otpKey = `otp:${phone}`;
  const otpEmailKey = `otp_email:${phone}`;
  const throttleKey = `otp_throttle:${phone}`;
  const normalizedEmail = fallbackEmail
    ? String(fallbackEmail).trim().toLowerCase()
    : null;

  // Prevent multiple OTP requests within 30 seconds
  const isThrottled = await redis.get(throttleKey);
  if (isThrottled) {
    throw new Error("Please wait before requesting another OTP");
  }

  const user = await User.findOne({ phone });
  const email = user?.email || normalizedEmail || null;

  if (String(process.env.SMS_ENABLED || "false") !== "true" && !email) {
    throw new Error("Email is required to receive OTP when SMS is unavailable");
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP for 5 minutes
  await redis.set(otpKey, generatedOtp, "EX", 300);

  // Set throttle key for 30 seconds
  await redis.set(throttleKey, "1", "EX", 30);

  if (email) {
    await redis.set(otpEmailKey, email, "EX", 300);
  }

  await otpQueue.add(
    {
      phone,
      otp: generatedOtp,
      email,
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
    },
  );

  return { message: "OTP sent successfully" };
};
const verifyEmail = async (token) => {
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() },
  }).select("+emailVerificationToken +emailVerificationExpires");
  if (!user) {
    throw new Error("Invalid or expired verification link");
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;

  await user.save();

  return { message: "Email verified successfully" };
};

const verifyOtp = async (phone, otp) => {
  if (!phone || !otp) {
    throw new Error("Phone and OTP are required");
  }

  const otpKey = `otp:${phone}`;
  const otpEmailKey = `otp_email:${phone}`;
  const attemptKey = `otp_attempts:${phone}`;

  const storedOtp = await redis.get(otpKey);

  if (!storedOtp) {
    throw new Error("OTP expired or not found");
  }

  if (storedOtp !== otp) {
    const attempts = await redis.incr(attemptKey);

    if (attempts === 1) {
      await redis.expire(attemptKey, 300);
    }

    if (attempts >= 5) {
      await redis.del(otpKey);
      await redis.del(otpEmailKey);
      throw new Error("Too many invalid attempts. OTP expired.");
    }

    throw new Error("Invalid OTP");
  }

  await redis.del(otpKey);
  await redis.del(attemptKey);
  const fallbackEmail = await redis.get(otpEmailKey);
  await redis.del(otpEmailKey);

  let user = await User.findOne({ phone });

  // Safe revive logic
  if (user && !user.isActive) {
    throw new Error("Your account has been deactivated. Contact support.");
  }

  if (!user) {
    const availableEmail =
      fallbackEmail && !(await User.exists({ email: fallbackEmail }))
        ? fallbackEmail
        : undefined;

    user = await User.create({
      phone,
      ...(availableEmail && { email: availableEmail }),
      authProvider: "otp",
      role: "user",
      isPhoneVerified: true,
    });
  } else if (!user.isPhoneVerified) {
    user.isPhoneVerified = true;
    await user.save();
  }

  //  FIX: return same structure as login
  return generateToken(user);
};

module.exports = {
  registerUser,
  loginUser,
  sendOtp,
  verifyOtp,
  verifyEmail,
};
