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

    // -------------------
    // CUSTOMER
    // -------------------
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },

    // -------------------
    // LEGACY SINGLE PICKUP/DROP (KEEP)
    // -------------------
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

    // -------------------
    // NEW MULTI-STOP STRUCTURE
    // -------------------
    stops: [
      {
        type: {
          type: String,
          enum: ["PICKUP", "DROP"],
          required: true,
        },
        address: { type: String, required: true },
        lat: Number,
        lng: Number,

        building: String,
        floor: String,
        unit: String,
        instructions: String,

        name: String,
        phone: String,
      },
    ],

    deliveryType: {
      type: String,
      enum: ["NOW", "EOD", "END_OF_DAY", "SCHEDULED"],
    },

    vehicleTypeId: {
      type: Number,
      index: true,
    },

    package: {
      weight: Number,
      category: String,
      description: String,
      declaredValue: Number,
    },

    payment: {
      method: {
        type: String,
        enum: ["CASH", "BANK_CARD", "CARD", "WALLET", "BALANCE"],
        default: "CASH",
      },
      feePayer: {
        type: String,
        enum: ["PICKUP", "DROP"],
        default: "DROP",
      },
      bankCardId: Number,
    },

    vehicle: {
      type: {
        type: String,
        index: true,
      },
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
      baseAmount: { type: Number },
      adjustedAmount: { type: Number },
      insurance: { type: Number, default: 0 },
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
      calculatedAt: { type: Date },
    },

    declaredValue: {
      type: Number,
      default: null,
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

      collectedAmount: {
        type: Number,
        default: 0,
      },

      codFee: {
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

    deliveredAt: {
      type: Date,
      index: true,
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

    pricingSnapshot: {
      basePrice: Number,

      marginPercent: Number,
      marginAmount: Number,

      platformFee: Number,
      platformFeeAmount: Number,

      handlingFee: Number,
      handlingFeeAmount: Number,

      surgeMultiplier: Number,
      surgeApplied: Boolean,

      vehicleType: String,
      vehicleMultiplier: Number,

      insurancePercent: Number,
      insuranceFeeAmount: Number,

      codFee: Number,

      finalPrice: Number,
    },

    codSettled: {
      type: Boolean,
      default: false,
    },

    walletRefunded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

orderSchema.index({ borzoOrderId: 1, provider: 1 }, { unique: true });
orderSchema.index({ user: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ user: 1, status: 1 });

orderSchema.index({ status: 1, createdAt: 1 });

orderSchema.index({ status: 1, deliveredAt: 1 });

orderSchema.index({ status: 1, "vehicle.type": 1 });

orderSchema.index({ status: 1, createdAt: 1, "vehicle.type": 1 });

module.exports = mongoose.model("Order", orderSchema);
