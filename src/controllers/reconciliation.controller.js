const Reconciliation = require("../models/Reconciliation");

const getMismatches = async (req, res) => {
  const data = await Reconciliation.find({ resolved: false }).populate("order");

  res.json({
    success: true,
    data,
  });
};

module.exports = {
  getMismatches,
};
