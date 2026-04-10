const mongoose = require("mongoose");
const adminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["ORDER", "DRIVER", "PAYMENT", "SYSTEM", "USER"],
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

    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminSupportTicket",
    },

    meta: {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
      driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("AdminNotification", adminNotificationSchema);
