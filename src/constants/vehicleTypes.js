// The current MoveKart Borzo production account accepts only vehicle type 8.
// Borzo documents other IDs globally, but the account rejects them with
// invalid_vehicle_type, so unsupported choices must not reach the UI or API.
module.exports = [
  {
    id: 8,
    code: "BIKE",
    name: "Motorbike",
    maxWeightKg: 20,
  },
];
