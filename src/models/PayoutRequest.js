const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    courierId: {
      type: String,
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    status: {
      type: String,
      enum: ["REQUESTED", "APPROVED", "REJECTED", "PAID"],
      default: "REQUESTED",
    },

    reference: {
      type: String,
      index: true,
    },

    notes: String,
  },
  { timestamps: true },
);

payoutSchema.index(
  { courierId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "REQUESTED" } },
);

module.exports = mongoose.model("PayoutRequest", payoutSchema);
