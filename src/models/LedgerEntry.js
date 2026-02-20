const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    reference: {
      type: String,
    },

    metadata: {
      type: Object,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);
