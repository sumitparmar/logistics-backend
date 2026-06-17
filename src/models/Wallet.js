const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
      index: true,
    },

    /**
     * Current usable balance
     * Existing code already uses this field.
     * DO NOT rename.
     */
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: process.env.CURRENCY || "INR",
      uppercase: true,
      trim: true,
    },

    /**
     * Analytics
     */
    totalCredits: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDebits: {
      type: Number,
      default: 0,
      min: 0,
    },

    transactionCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Logistics settlement support
     * Future-ready for COD settlements.
     */
    pendingSettlement: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Funds available for withdrawal.
     */
    withdrawableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Wallet lifecycle
     */
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "LOCKED"],
      default: "ACTIVE",
    },

    /**
     * Last financial activity
     */
    lastTransactionAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Helpful indexes
 */
walletSchema.index({ user: 1 });
walletSchema.index({ status: 1 });

module.exports = mongoose.model("Wallet", walletSchema);
