const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    borzoOrderId: {
      type: String,
      required: true,
      index: true,
    },

    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },

    pickup: {
      address: { type: String, required: true },
      lat: Number,
      lng: Number,
    },

    drop: {
      address: { type: String, required: true },
      lat: Number,
      lng: Number,
    },

    courier: {
      courierId: Number,
      name: String,
      surname: String,
      phone: String,
      photoUrl: String,

      location: {
        lat: Number,
        lng: Number,
      },
    },

    delivery: {
      deliveryId: Number,
      status: String,
      statusDescription: String,
      statusDatetime: Date,
      trackingUrl: String,
    },

    pricing: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },

    cod: {
      enabled: {
        type: Boolean,
        default: false,
      },
      amount: {
        type: Number,
        default: 0,
      },
    },

    status: {
      type: String,
      enum: [
        "CREATED",
        "ASSIGNED",
        "PICKED_UP",
        "IN_TRANSIT",
        "DELIVERED",
        "CANCELLED",
        "FAILED",
      ],
      default: "CREATED",
    },

    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "CREATED",
            "ASSIGNED",
            "PICKED_UP",
            "IN_TRANSIT",
            "DELIVERED",
            "CANCELLED",
            "FAILED",
          ],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    provider: {
      type: String,
      default: "BORZO",
      index: true,
    },

    rawProviderResponse: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true },
);

orderSchema.index({ borzoOrderId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model("Order", orderSchema);
