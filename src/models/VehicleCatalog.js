const mongoose = require("mongoose");

const vehicleCatalogSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      index: true,
    },

    providerVehicleTypeId: {
      type: Number,
      required: true,
    },

    code: {
      type: String, // BIKE, MINI_TRUCK etc (normalized)
      required: true,
    },

    displayName: {
      type: String,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

vehicleCatalogSchema.index(
  { provider: 1, providerVehicleTypeId: 1 },
  { unique: true },
);

module.exports = mongoose.model("VehicleCatalog", vehicleCatalogSchema);
