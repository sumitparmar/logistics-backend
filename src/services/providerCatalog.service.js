const borzoVehicles = require("../providers/borzo/catalog/vehicleTypes");

const getVehicleTypes = async () => {
  return borzoVehicles;
};

module.exports = {
  getVehicleTypes,
};
