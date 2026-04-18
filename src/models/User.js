const mongoose = require("mongoose");
const normalizePhone = require("../utils/normalizePhone");
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

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // ROLE MANAGEMENT
    role: {
      type: String,
      enum: ["user", "admin", "business"],
      default: "user",
    },

    adminRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminRole",
      default: null,
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

userSchema.pre("save", function () {
  if (this.phone) {
    this.phone = normalizePhone(this.phone);
  }

  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
});

module.exports = mongoose.model("User", userSchema);
