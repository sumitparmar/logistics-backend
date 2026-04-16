const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    platformName: {
      type: String,
      default: "MoveKart Logistics",
      trim: true,
    },

    supportEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    supportPhone: {
      type: String,
      default: "",
      trim: true,
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata",
      trim: true,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },

    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    allowRegistrations: {
      type: Boolean,
      default: true,
    },

    newOrderAlerts: {
      type: Boolean,
      default: true,
    },

    supportAlerts: {
      type: Boolean,
      default: true,
    },

    sessionTimeoutMinutes: {
      type: Number,
      default: 60,
      min: 5,
      max: 1440,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
