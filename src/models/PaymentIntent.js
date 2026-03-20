const mongoose = require("mongoose");

const paymentIntentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    gateway: {
      type: String,
      enum: ["RAZORPAY", "PULSE"],
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
    refundedAt: {
      type: Date,
      default: null,
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
paymentIntentSchema.index(
  { gatewayPaymentId: 1 },
  { unique: true, sparse: true },
);
paymentIntentSchema.index({ status: 1, refundedAt: -1 });

module.exports = mongoose.model("PaymentIntent", paymentIntentSchema);
