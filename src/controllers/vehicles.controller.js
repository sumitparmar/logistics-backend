const vehicleTypes = require("../constants/vehicleTypes");
const { sendSuccess } = require("../utils/response");

const getVehicleTypes = async (req, res) => {
  return sendSuccess(res, vehicleTypes, "Vehicle types fetched");
};

module.exports = { getVehicleTypes };
