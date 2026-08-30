const Order = require("../models/Order");
const Wallet = require("../models/Wallet");
const { getOrderReference } = require("../utils/orderReference");

const getDashboardSummaryService = async (userId) => {
  const [
    totalOrders,
    activeOrders,
    recentOrdersDocs,
    walletDoc,
    statusBreakdown,
    spendingDocs,
  ] = await Promise.all([
    // TOTAL ORDERS
    Order.countDocuments({ user: userId }),

    // ACTIVE ORDERS — correct schema enum values
    Order.countDocuments({
      user: userId,
      status: { $in: ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
    }),

    // RECENT ORDERS — all fields needed for dashboard table
    Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "_id borzoOrderId pickup drop status pricing vehicleTypeId createdAt",
      ),

    // REAL WALLET BALANCE
    Wallet.findOne({ user: userId }).select("balance currency"),

    // STATUS BREAKDOWN — group by status
    Order.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // SPENDING LAST 6 MONTHS — for chart
    Order.aggregate([
      {
        $match: {
          user: userId,
          status: "DELIVERED",
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          total: { $sum: "$pricing.amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  // Build status breakdown map
  const statusMap = {
    CREATED: 0,
    ASSIGNED: 0,
    PICKED_UP: 0,
    IN_TRANSIT: 0,
    DELIVERED: 0,
    CANCELLED: 0,
    FAILED: 0,
  };

  statusBreakdown.forEach((s) => {
    if (Object.prototype.hasOwnProperty.call(statusMap, s._id)) {
      statusMap[s._id] = s.count;
    }
  });

  // Build spending chart — last 6 months with month labels
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const spendingChart = spendingDocs.map((d) => ({
    month: monthNames[d._id.month - 1],
    year: d._id.year,
    total: d.total,
    count: d.count,
  }));

  return {
    totalOrders,
    activeOrders,

    // Real wallet balance — never hardcoded
    walletBalance: walletDoc?.balance ?? 0,
    walletCurrency: walletDoc?.currency ?? process.env.CURRENCY ?? "INR",

    // Status breakdown for strip
    statusBreakdown: statusMap,

    // Spending chart data for bar chart
    spendingChart,

    // Recent orders for table
    recentOrders: recentOrdersDocs.map((o) => ({
      id: o._id,
      borzoOrderId: o.borzoOrderId,
      displayOrderId: getOrderReference(o.borzoOrderId || o._id),
      pickup: o.pickup?.address || "N/A",
      drop: o.drop?.address || "N/A",
      status: o.status || "CREATED",
      amount: o.pricing?.amount ?? 0,
      currency: o.pricing?.currency ?? "INR",
      vehicleTypeId: o.vehicleTypeId ?? null,
      createdAt: o.createdAt,
    })),
  };
};

module.exports = {
  getDashboardSummaryService,
};
