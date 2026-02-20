const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    paymentIntent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentIntent",
      required: true,
    },

    gatewayRefundId: String,

    amount: Number,

    status: {
      type: String,
      enum: ["INITIATED", "SUCCESS", "FAILED"],
      default: "INITIATED",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Refund", refundSchema);
