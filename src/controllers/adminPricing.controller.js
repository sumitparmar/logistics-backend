const AdminPricing = require("../models/adminPricing.model");

exports.getAdminPricing = async (req, res) => {
  try {
    let config = await AdminPricing.findOne({ isActive: true });

    // Ensure at least one config exists
    if (!config) {
      config = await AdminPricing.create({});
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
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

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
