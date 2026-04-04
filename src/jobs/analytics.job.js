const cron = require("node-cron");
const Order = require("../models/Order");
const AnalyticsDaily = require("../models/AnalyticsDaily");

// Runs every night at 1 AM
cron.schedule("0 1 * * *", async () => {
  try {
    console.log(" Running daily analytics job...");

    const today = new Date();
    today.setDate(today.getDate() - 1);
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);

    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    const match = {
      status: "DELIVERED",
      createdAt: { $gte: start, $lte: end },
    };

    // 🔹 SUMMARY
    const summary = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.amount" },
          avgOrderValue: { $avg: "$pricing.amount" },
        },
      },
    ]);

    // 🔹 VEHICLE
    const vehicles = await Order.aggregate([
      { $match: match },
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

    const base = summary[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
    };

    const dateStr = today.toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });
    await AnalyticsDaily.findOneAndUpdate(
      { date: dateStr },
      {
        date: dateStr,
        totalOrders: base.totalOrders,
        totalRevenue: base.totalRevenue,
        avgOrderValue: base.avgOrderValue,
        vehicleBreakdown: vehicles,
      },
      { upsert: true, new: true },
    );

    console.log(" Daily analytics saved:", dateStr);
  } catch (err) {
    console.error("❌ Analytics cron error:", err.message);
  }
});
