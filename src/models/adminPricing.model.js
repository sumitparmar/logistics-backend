const mongoose = require("mongoose");

const adminPricingSchema = new mongoose.Schema(
  {
    isActive: { type: Boolean, default: true },

    marginPercent: { type: Number, default: 0 },

    baseFees: {
      platformFee: { type: Number, default: 0 },
      handlingFee: { type: Number, default: 0 },
    },

    surge: {
      enabled: { type: Boolean, default: false },
      multiplier: { type: Number, default: 1 },
      startTime: { type: String }, // "18:00"
      endTime: { type: String }, // "22:00"
    },

    vehicleOverrides: [
      {
        type: {
          type: String,
          enum: ["1", "2", "3", "5", "8"],
        },
        multiplier: { type: Number, default: 1 },
      },
    ],

    extras: {
      insurancePercent: { type: Number, default: 0 },
      codFee: { type: Number, default: 0 },
    },

    tax: {
      gstEnabled: { type: Boolean, default: true },
      gstPercent: { type: Number, default: 18 },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AdminPricing", adminPricingSchema);
