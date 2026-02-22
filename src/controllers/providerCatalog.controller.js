const { getVehicleTypes } = require("../services/providerCatalog.service");

const getVehicles = async (req, res, next) => {
  try {
    const vehicles = await getVehicleTypes();
    return res.json({ success: true, data: vehicles });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getVehicles,
};
