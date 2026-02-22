const VehicleCatalog = require("../models/VehicleCatalog");
const pulseService = require("./pulse.service");

async function syncVehicleCatalog() {
  // Dummy calculate request to fetch available vehicles
  const response = await pulseService.calculateOrder({
    matter: "catalog_probe",
    points: [
      { address: process.env.HEALTH_PICKUP_ADDRESS },
      { address: process.env.HEALTH_DROP_ADDRESS },
    ],
  });

  if (!response?.order) {
    throw new Error("Failed to fetch vehicle catalog");
  }

  const vehicleTypeId = response.order.vehicle_type_id;

  await VehicleCatalog.updateOne(
    {
      provider: "BORZO",
      providerVehicleTypeId: vehicleTypeId,
    },
    {
      provider: "BORZO",
      providerVehicleTypeId: vehicleTypeId,
      code: String(vehicleTypeId),
      displayName: `Vehicle ${vehicleTypeId}`,
      isActive: true,
    },
    { upsert: true },
  );
}

async function getActiveVehicles() {
  return VehicleCatalog.find({ isActive: true });
}

module.exports = {
  syncVehicleCatalog,
  getActiveVehicles,
};
