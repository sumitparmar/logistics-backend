const { getVehicleTypes } = require("../services/providerCatalog.service");
const { sendSuccess } = require("../utils/response");

const getVehicles = async (req, res, next) => {
  try {
    const vehicles = await getVehicleTypes(req.query);

    return sendSuccess(res, vehicles, "Vehicle types fetched");
  } catch (err) {
    next(err);
  }
};

module.exports = { getVehicles };
