const Order = require("../models/Order");
const { startOfDay, startOfWeek, startOfMonth } = require("date-fns");
exports.getAdminPricingAnalytics = async (req, res) => {
  try {
    const { range } = req.query;

    let dateFilter = {};

    if (range === "today") {
      dateFilter.createdAt = { $gte: startOfDay(new Date()) };
    }

    if (range === "week") {
      dateFilter.createdAt = { $gte: startOfWeek(new Date()) };
    }

    if (range === "month") {
      dateFilter.createdAt = { $gte: startOfMonth(new Date()) };
    }

    const orders = await Order.find({
      "pricingSnapshot.finalPrice": { $exists: true },
      ...dateFilter,
    });

    let totalOrders = 0;
    let totalRevenue = 0;
    let totalMargin = 0;

    const vehicleMap = {};

    orders.forEach((o) => {
      const s = o.pricingSnapshot;
      if (!s) return;

      totalOrders++;
      totalRevenue += s.finalPrice;

      const margin = s.finalPrice - s.basePrice;
      totalMargin += margin;

      const type = s.vehicleType || "unknown";

      if (!vehicleMap[type]) {
        vehicleMap[type] = { orders: 0, revenue: 0 };
      }

      vehicleMap[type].orders++;
      vehicleMap[type].revenue += s.finalPrice;
    });

    res.json({
      totalOrders,
      totalRevenue,
      avgOrderValue: totalRevenue / (totalOrders || 1),
      avgMargin: totalMargin / (totalOrders || 1),
      vehicleBreakdown: Object.keys(vehicleMap).map((k) => ({
        type: k,
        ...vehicleMap[k],
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
