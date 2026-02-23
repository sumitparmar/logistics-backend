const mongoose = require("mongoose");

const courierWalletSchema = new mongoose.Schema(
  {
    courierId: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CourierWallet", courierWalletSchema);
