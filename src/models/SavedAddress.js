const mongoose = require("mongoose");

const savedAddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ✅ performance safe
    },

    label: {
      type: String,
      enum: ["HOME", "OFFICE", "OTHER"],
      default: "OTHER",
    },

    name: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },

    notes: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("SavedAddress", savedAddressSchema);
