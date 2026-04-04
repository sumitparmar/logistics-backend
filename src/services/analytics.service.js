const mongoose = require("mongoose");
const Order = require("../models/Order");

const Wallet = require("../models/Wallet");
const getOrderSummaryService = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    todayOrders,
    activeOrders,
    deliveredOrders,
    cancelledOrders,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: todayStart } }),
    Order.countDocuments({
      status: { $in: ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
    }),
    Order.countDocuments({ status: "DELIVERED" }),
    Order.countDocuments({ status: "CANCELLED" }),
  ]);

  return {
    totalOrders,
    todayOrders,
    activeOrders,
    deliveredOrders,
    cancelledOrders,
  };
};

/**
 * DAILY ORDERS GRAPH
 */
const getDailyOrdersService = async (userId, days = 14) => {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const result = await Order.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return result.map((r) => ({
    date: r._id,
    orders: r.count,
  }));
};

async function getRevenueSummaryService() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalCodAmount, todayCodAmount, walletCreditedAmount] =
    await Promise.all([
      // Total COD enabled orders
      Order.aggregate([
        { $match: { "cod.enabled": true } },
        { $group: { _id: null, amount: { $sum: "$pricing.amount" } } },
      ]),

      // Today COD enabled orders
      Order.aggregate([
        {
          $match: {
            "cod.enabled": true,
            createdAt: { $gte: todayStart },
          },
        },
        { $group: { _id: null, amount: { $sum: "$pricing.amount" } } },
      ]),

      // Wallet credits from COD settlement
      Wallet.aggregate([
        { $match: { type: "CREDIT", reason: "COD_ORDER_DELIVERED" } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
    ]);

  return {
    totalCodAmount: totalCodAmount[0]?.amount || 0,
    todayCodAmount: todayCodAmount[0]?.amount || 0,
    walletCreditedAmount: walletCreditedAmount[0]?.amount || 0,
  };
}

async function getProviderBreakdownService() {
  const result = await Order.aggregate([
    {
      $group: {
        _id: "$provider",
        orders: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        provider: "$_id",
        orders: 1,
      },
    },
  ]);

  return result;
}

async function getVehicleBreakdownService() {
  const result = await Order.aggregate([
    {
      $match: {
        "vehicle.type": { $ne: null },
      },
    },

    {
      $group: {
        _id: "$vehicle.type",
        orders: { $sum: 1 },
      },
    },

    {
      $project: {
        _id: 0,
        vehicleType: { $toString: "$_id" },
        orders: 1,
      },
    },
  ]);

  return result;
}

const getPricingAnalyticsService = async (range = "today") => {
  const now = new Date();
  let startDate;

  if (range === "today") {
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (range === "week") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const matchStage = {
    deliveredAt: { $gte: startDate },
    status: "DELIVERED",
  };

  //  TOTALS
  const summary = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.amount" },
        avgOrderValue: { $avg: "$pricing.amount" },
      },
    },
  ]);

  // 🔹 VEHICLE BREAKDOWN (REVENUE BASED)
  const vehicleBreakdown = await Order.aggregate([
    {
      $match: {
        ...matchStage,
        "vehicle.type": { $ne: null },
      },
    },
    {
      $group: {
        _id: "$vehicle.type",
        revenue: { $sum: "$pricing.amount" },
      },
    },
    {
      $project: {
        _id: 0,
        type: { $toString: "$_id" },
        revenue: 1,
      },
    },
  ]);

  // 🔹 REVENUE TREND (TIME SERIES)
  let revenueTrend = [];

  if (range === "today") {
    const hourly = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { hour: { $hour: "$deliveredAt" } },
          revenue: { $sum: "$pricing.amount" },
        },
      },
      { $sort: { "_id.hour": 1 } },
      {
        $project: {
          _id: 0,
          label: {
            $concat: [{ $toString: "$_id.hour" }, ":00"],
          },
          revenue: 1,
        },
      },
    ]);

    revenueTrend = hourly;
  } else {
    const daily = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$deliveredAt",
              },
            },
          },
          revenue: { $sum: "$pricing.amount" },
        },
      },
      { $sort: { "_id.date": 1 } },
      {
        $project: {
          _id: 0,
          label: {
            $dateToString: {
              format: "%d %b",
              date: {
                $dateFromString: {
                  dateString: "$_id.date",
                },
              },
            },
          },
          revenue: 1,
        },
      },
    ]);

    const map = new Map(daily.map((d) => [d.label, d.revenue]));

    const result = [];

    const current = new Date(startDate);
    const end = new Date();

    while (current <= end) {
      const label = current.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      });

      result.push({
        label,
        revenue: map.get(label) || 0,
      });

      current.setDate(current.getDate() + 1);
    }

    revenueTrend = result;
  }

  const base = summary[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  };

  return {
    totalOrders: base.totalOrders,
    totalRevenue: base.totalRevenue,
    avgOrderValue: base.avgOrderValue,
    avgMargin: 0, // you don’t store margin yet
    vehicleBreakdown,
    revenueTrend,
  };
};

module.exports = {
  getOrderSummaryService,
  getDailyOrdersService,
  getRevenueSummaryService,
  getProviderBreakdownService,
  getVehicleBreakdownService,
  getPricingAnalyticsService,
};
