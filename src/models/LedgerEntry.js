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
        "COD_SETTLEMENT",
        "REFUND",
        "TOPUP",
        "WITHDRAWAL",
        "DELIVERY_CHARGE",
        "ADJUSTMENT",
        "PROMOTIONAL_CREDIT",
        "PENALTY",
        "TEST_CREDIT",
        "TEST_DEBIT",
      ],
      required: true,
      index: true,
    },

    category: {
      type: String,
      default: "GENERAL",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
      index: true,
    },

    reference: {
      type: String,
      trim: true,
      default: null,
    },

    metadata: {
      type: Object,
      default: {},
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
