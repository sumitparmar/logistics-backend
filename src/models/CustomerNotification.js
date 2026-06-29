const mongoose = require("mongoose");

const customerNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminSupportTicket",
      default: null,
    },

    type: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },

    actionLabel: String,
    actionUrl: String,

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

customerNotificationSchema.index({
  user: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "CustomerNotification",
  customerNotificationSchema,
);
