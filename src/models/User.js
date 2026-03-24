const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // BASIC PROFILE
    name: {
      type: String,
      trim: true,
      minlength: 2,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },

    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      minlength: 6,
      select: false,
    },

    // AUTH TYPE
    authProvider: {
      type: String,
      enum: ["email", "otp", "guest"],
      default: "otp",
    },

    // VERIFICATION FLAGS
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpire: {
      type: Date,
      select: false,
    },

    // ACCOUNT STATUS
    isActive: {
      type: Boolean,
      default: true,
    },

    // ROLE MANAGEMENT
    role: {
      type: String,
      enum: ["user", "admin", "business"],
      default: "user",
    },

    // OPTIONAL METADATA
    lastLoginAt: {
      type: Date,
    },

    deliveryMode: {
      type: String,
      enum: ["PERSONAL", "BUSINESS"],
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
