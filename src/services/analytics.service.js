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
        { $group: { _id: null, amount: { $sum: "$cod.amount" } } },
      ]),

      // Today COD enabled orders
      Order.aggregate([
        {
          $match: {
            "cod.enabled": true,
            createdAt: { $gte: todayStart },
          },
        },
        { $group: { _id: null, amount: { $sum: "$cod.amount" } } },
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

module.exports = {
  getOrderSummaryService,
  getDailyOrdersService,
  getRevenueSummaryService,
  getProviderBreakdownService,
  getVehicleBreakdownService,
};
