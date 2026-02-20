const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { sendSms } = require("./sms.service");

const registerUser = async (data) => {
  const { name, email, phone, password } = data;

  // Check existing user
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }],
  });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    phone,
    password: hashedPassword,
    authProvider: "email",
  });

  return generateToken(user._id);
};

// Login User

const loginUser = async (data) => {
  const { email, password, phone, otp } = data;

  // EMAIL + PASSWORD LOGIN
  if (email && password) {
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    return generateToken(user._id);
  }

  // PHONE + OTP LOGIN
  if (phone && otp) {
    const result = await verifyOtp(phone, otp);
    return result.token;
  }

  throw new Error("Invalid login method");
};

// generate JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const sendOtp = async (phone) => {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  const existingOtp = await Otp.findOne({ phone });
  const now = new Date();

  // If OTP exists
  if (existingOtp) {
    const secondsSinceLastSend = (now - existingOtp.lastSentAt) / 1000;

    if (secondsSinceLastSend < 30) {
      throw new Error("Please wait before requesting another OTP");
    }

    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    if (existingOtp.createdAt > oneHourAgo && existingOtp.attempts >= 5) {
      throw new Error("Too many OTP requests. Try again later.");
    }

    existingOtp.attempts += 1;
    existingOtp.lastSentAt = now;

    existingOtp.otp = Math.floor(100000 + Math.random() * 900000).toString();
    existingOtp.expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    await existingOtp.save();

    //  SEND SMS
    await sendSms(phone, `Your OTP is ${existingOtp.otp}`);

    return { message: "OTP sent successfully" };
  }

  // First time OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  await Otp.create({
    phone,
    otp: generatedOtp,
    expiresAt,
    attempts: 1,
    lastSentAt: now,
  });

  // SEND SMS
  await sendSms(phone, `Your OTP is ${generatedOtp}`);

  return { message: "OTP sent successfully" };
};

const verifyOtp = async (phone, otp) => {
  if (!phone || !otp) {
    throw new Error("Phone and OTP are required");
  }

  const existingOtp = await Otp.findOne({ phone, otp });

  if (!existingOtp) {
    throw new Error("Invalid OTP");
  }

  // Find existing user
  let user = await User.findOne({ phone });

  // If user does not exist, create
  if (!user) {
    user = await User.create({
      phone,
      authProvider: "otp",
    });
  }

  // Delete OTP after successful verification
  await Otp.deleteMany({ phone });

  // Generate JWT
  const token = generateToken(user._id);

  return {
    message: "OTP verified successfully",
    token,
  };
};

module.exports = {
  registerUser,
  loginUser,
  sendOtp,
  verifyOtp,
};
