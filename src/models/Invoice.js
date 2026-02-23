const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    lineItems: [
      {
        label: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],

    subtotal: {
      type: Number,
      required: true,
    },

    tax: {
      type: Number,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["GENERATED", "CANCELLED"],
      default: "GENERATED",
    },
  },
  { timestamps: true },
);

invoiceSchema.index({ order: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
