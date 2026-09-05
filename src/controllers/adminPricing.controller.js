const AdminPricing = require("../models/adminPricing.model");
const { emitPricingUpdate } = require("../services/realtime.service");

exports.getAdminPricing = async (req, res) => {
  try {
    let config = await AdminPricing.findOne({ isActive: true });

    // Ensure at least one config exists
    if (!config) {
      config = await AdminPricing.create({});
    }

    res.json(config);
  } catch (err) {
    console.error("getAdminPricing error:", err.message);
    res.status(500).json({ message: "Unable to load pricing settings." });
  }
};

exports.updateAdminPricing = async (req, res) => {
  try {
    let config = await AdminPricing.findOne();

    if (!config) {
      config = new AdminPricing(req.body);
    } else {
      Object.assign(config, req.body);
    }

    await config.save();
    emitPricingUpdate(config);

    res.json(config);
  } catch (err) {
    console.error("updateAdminPricing error:", err.message);
    res.status(500).json({ message: "Unable to save pricing settings." });
  }
};
