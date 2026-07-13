const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      enum: [
        // Wallet
        "TOPUP",
        "WITHDRAWAL",

        // Logistics
        "ORDER_PAYMENT",
        "DELIVERY_CHARGE",
        "ORDER_REFUND",
        "ORDER_CANCEL_REFUND",

        // COD
        "COD_SETTLEMENT",
        "COD_ADJUSTMENT",

        // Payment Gateway
        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",
        "PAYMENT_REFUND",

        // Admin
        "MANUAL_CREDIT",
        "MANUAL_DEBIT",
        "ADJUSTMENT",

        // Rewards
        "PROMOTIONAL_CREDIT",
        "CASHBACK",
        "REFERRAL_REWARD",

        // Charges
        "PENALTY",

        // Testing
        "TEST_CREDIT",
        "TEST_DEBIT",
      ],

      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: [
        "PAYMENT",
        "ORDER",
        "COD",
        "REFUND",
        "WITHDRAWAL",
        "REWARD",
        "PENALTY",
        "ADJUSTMENT",
        "SYSTEM",
      ],
      default: "SYSTEM",
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REVERSED"],
      default: "COMPLETED",
      index: true,
    },

    reference: {
      type: String,
      trim: true,
      default: null,
    },

    balanceBefore: {
      type: Number,
      default: 0,
    },

    balanceAfter: {
      type: Number,
      default: 0,
    },

    metadata: {
      type: Object,
      default: {},
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

ledgerEntrySchema.index({
  wallet: 1,
  createdAt: -1,
});

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);
