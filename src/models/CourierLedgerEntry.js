const mongoose = require("mongoose");

const courierLedgerSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourierWallet",
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

    reference: String,

    metadata: Object,
  },
  { timestamps: true },
);

module.exports = mongoose.model("CourierLedgerEntry", courierLedgerSchema);
