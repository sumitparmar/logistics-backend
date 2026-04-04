const mongoose = require("mongoose");

const analyticsDailySchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      unique: true,
    },

    totalOrders: Number,
    totalRevenue: Number,
    avgOrderValue: Number,

    vehicleBreakdown: [
      {
        type: String,
        revenue: Number,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("AnalyticsDaily", analyticsDailySchema);
