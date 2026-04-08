const mongoose = require("mongoose");

const adminSupportMessageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminSupportTicket",
      required: true,
    },

    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model(
  "AdminSupportMessage",
  adminSupportMessageSchema,
);
