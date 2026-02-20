const mongoose = require("mongoose");

const paymentIntentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    gateway: {
      type: String,
      enum: ["RAZORPAY"],
      required: true,
    },

    gatewayOrderId: String,
    gatewayPaymentId: String,

    amount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["UPI", "CARD", "QR", "NETBANKING", "WALLET"],
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    status: {
      type: String,
      enum: [
        "CREATED",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
        "REFUND_REQUESTED",
        "REFUND_PROCESSING",
        "REFUNDED",
        "REFUND_FAILED",
      ],
      default: "CREATED",
    },

    statusHistory: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    metadata: Object,
  },
  { timestamps: true },
);

paymentIntentSchema.index({ gatewayOrderId: 1 });
paymentIntentSchema.index({ gatewayPaymentId: 1 });

module.exports = mongoose.model("PaymentIntent", paymentIntentSchema);
