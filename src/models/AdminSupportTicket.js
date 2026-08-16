const mongoose = require("mongoose");

const adminSupportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },

    name: String,
    email: String,
    phone: String,

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "OPEN",
        "IN_PROGRESS",
        "WAITING_CUSTOMER",
        "RESOLVED",
        "CLOSED",
        "REOPENED",
      ],
      default: "OPEN",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    category: {
      type: String,
      enum: [
        "ORDER_ISSUE",
        "PAYMENT",
        "REFUND",
        "ACCOUNT",
        "TECHNICAL",
        "SAFETY",
        "OTHER",
      ],
      default: "OTHER",
    },

    ticketNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    lastMessageAt: Date,

    lastRepliedBy: {
      type: String,
      enum: ["user", "admin"],
    },

    unreadForUser: {
      type: Number,
      default: 0,
    },

    unreadForAdmin: {
      type: Number,
      default: 0,
    },

    resolvedAt: Date,

    closedAt: Date,

    rating: {
      stars: Number,
      feedback: String,
      submittedAt: Date,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("AdminSupportTicket", adminSupportTicketSchema);
