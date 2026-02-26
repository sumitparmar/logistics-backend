const Order = require("../models/Order");

const getDashboardSummaryService = async (userId) => {
  const [totalOrders, activeOrders, recentOrders] = await Promise.all([
    // TOTAL
    Order.countDocuments({ user: userId }),

    // ACTIVE
    Order.countDocuments({
      user: userId,
      status: { $in: ["CREATED", "ASSIGNED", "IN_PROGRESS"] },
    }),

    // RECENT
    Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("_id drop createdAt"),
  ]);

  return {
    totalOrders,
    activeOrders,
    walletBalance: 0,
    recentOrders: recentOrders.map((o) => ({
      id: o._id,
      drop: o.drop?.address || "N/A",
      createdAt: o.createdAt,
    })),
  };
};

module.exports = {
  getDashboardSummaryService,
};
