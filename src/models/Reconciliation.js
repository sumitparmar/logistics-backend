const mongoose = require("mongoose");

const reconciliationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    borzoOrderId: {
      type: String,
      required: true,
      index: true,
    },

    expectedAmount: {
      type: Number,
      required: true,
    },

    providerAmount: {
      type: Number,
      required: true,
    },

    difference: {
      type: Number,
      required: true,
    },

    localStatus: {
      type: String,
      required: true,
    },

    providerStatus: {
      type: String,
      required: true,
    },

    resolved: {
      type: Boolean,
      default: false,
    },

    checkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

reconciliationSchema.index(
  {
    order: 1,
    providerAmount: 1,
    providerStatus: 1,
    localStatus: 1,
    resolved: 1,
  },
  { unique: true },
);

module.exports = mongoose.model("Reconciliation", reconciliationSchema);
