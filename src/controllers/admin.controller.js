const healthStore = require("../providers/providerHealth.store");
const Reconciliation = require("../models/Reconciliation");
const FailedJob = require("../models/failedJob.model");
const User = require("../models/User");
const Order = require("../models/Order");
const getProviderHealth = async (req, res) => {
  return res.json({
    success: true,
    data: healthStore.snapshot(),
  });
};

const getReconciliationIssues = async (req, res) => {
  const issues = await Reconciliation.find({ resolved: false })
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ success: true, data: issues });
};

const getFailedJobs = async (req, res) => {
  const jobs = await FailedJob.find().sort({ createdAt: -1 }).limit(100);

  res.json({ success: true, data: jobs });
};

const getWebhookFailures = async (req, res) => {
  return res.json({ success: true, data: [] });
};

// const Order = require("../models/Order");
const Wallet = require("../models/Wallet");

// ORDERS SUMMARY
const getOrdersSummary = async (req, res) => {
  const total = await Order.countDocuments();

  const byStatus = await Order.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  return res.json({
    success: true,
    data: { total, byStatus },
  });
};

// REVENUE SUMMARY
const getRevenueSummary = async (req, res) => {
  const result = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$pricing.amount" },
      },
    },
  ]);

  return res.json({
    success: true,
    data: {
      totalRevenue: result[0]?.totalRevenue || 0,
    },
  });
};

// COD OUTSTANDING
const getCodOutstanding = async (req, res) => {
  const result = await Order.aggregate([
    {
      $match: {
        "cod.enabled": true,
        codSettled: false,
        status: "DELIVERED",
      },
    },
    {
      $group: {
        _id: null,
        outstanding: { $sum: "$cod.amount" },
      },
    },
  ]);

  return res.json({
    success: true,
    data: {
      outstanding: result[0]?.outstanding || 0,
    },
  });
};

// WALLET BALANCES
const getWalletBalances = async (req, res) => {
  const result = await Wallet.aggregate([
    {
      $group: {
        _id: null,
        totalBalance: { $sum: "$balance" },
      },
    },
  ]);

  return res.json({
    success: true,
    data: {
      totalBalance: result[0]?.totalBalance || 0,
    },
  });
};

// PROVIDER PERFORMANCE
const getProviderPerformance = async (req, res) => {
  const result = await Order.aggregate([
    {
      $group: {
        _id: {
          provider: "$provider",
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  return res.json({
    success: true,
    data: result,
  });
};

const getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          "name email phone role isActive isEmailVerified isPhoneVerified authProvider lastLoginAt createdAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("getUserById error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;

    const updatePayload = {
      name,
      email,
      isActive,
    };

    if (role) {
      if (role === "admin" && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Not allowed to assign admin role",
        });
      }

      updatePayload.role = role;
    }

    if (req.user._id.toString() === req.params.id && role && role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own admin access",
      });
    }

    const user = await User.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("updateUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Update failed",
    });
  }
};

function calculateGrowth(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

const getOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = (req.query.search || "").trim();
    const status = req.query.status || "";
    const skip = (page - 1) * limit;

    let filter = {};

    // SEARCH FILTER
    if (search) {
      filter.$or = [
        { borzoOrderId: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
        { "customer.phone": { $regex: search, $options: "i" } },
      ];
    }

    // STATUS FILTER
    if (status && status !== "ALL") {
      if (status === "IN_PROGRESS") {
        filter.status = { $in: ["ASSIGNED", "IN_TRANSIT"] };
      } else {
        filter.status = status;
      }
    }

    // BASE FILTER (for counts)
    const baseFilter = {};

    if (search.length > 0) {
      baseFilter.$or = [
        { borzoOrderId: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
        { "customer.phone": { $regex: search, $options: "i" } },
      ];
    }

    const [orders, filteredTotal, globalTotal] = await Promise.all([
      Order.find(filter)
        .select("_id borzoOrderId customer pricing status provider createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Order.countDocuments(filter), // for table
      Order.countDocuments({}), // for ALL count (no filter)
    ]);

    const statusAggregation = await Order.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {
      ALL: globalTotal,
      CREATED: 0,
      IN_PROGRESS: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    // map aggregation to UI format
    statusAggregation.forEach((item) => {
      if (item._id === "CREATED") statusCounts.CREATED = item.count;
      if (item._id === "DELIVERED") statusCounts.DELIVERED = item.count;
      if (item._id === "CANCELLED") statusCounts.CANCELLED = item.count;

      if (item._id === "ASSIGNED" || item._id === "IN_TRANSIT") {
        statusCounts.IN_PROGRESS += item.count;
      }
    });

    return res.json({
      success: true,
      data: orders,
      pagination: {
        total: filteredTotal,
        page,
        limit,
        totalPages: Math.ceil(filteredTotal / limit),
      },
      statusCounts,
    });
  } catch (error) {
    console.error("getOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

const getDashboard = async (req, res) => {
  try {
    const range = req.query.range || "month";

    const now = new Date();
    let startDate = new Date();

    let prevStartDate = new Date(startDate);

    if (range === "today") {
      prevStartDate.setDate(prevStartDate.getDate() - 1);
    } else if (range === "week") {
      prevStartDate.setDate(prevStartDate.getDate() - 7);
    } else {
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    }

    if (range === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "week") {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setMonth(now.getMonth() - 1);
    }

    // ---- TOTAL (ALL TIME - keep same as before) ----
    const [totalUsers, totalOrders, revenueAgg] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$pricing.amount" },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    // ---- FILTERED COUNTS (BASED ON RANGE) ----
    const usersCount = await User.countDocuments({
      createdAt: { $gte: startDate },
    });

    const prevUsersCount = await User.countDocuments({
      createdAt: {
        $gte: prevStartDate,
        $lt: startDate,
      },
    });

    const usersChange = calculateGrowth(usersCount, prevUsersCount);

    const ordersCount = await Order.countDocuments({
      createdAt: { $gte: startDate },
    });

    const prevOrdersCount = await Order.countDocuments({
      createdAt: {
        $gte: prevStartDate,
        $lt: startDate,
      },
    });

    const ordersChange = calculateGrowth(ordersCount, prevOrdersCount);

    const revenueAggFiltered = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$pricing.amount" },
        },
      },
    ]);

    const revenueFiltered = revenueAggFiltered[0]?.total || 0;

    const prevRevenueAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: prevStartDate, $lt: startDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$pricing.amount" },
        },
      },
    ]);

    const prevRevenue = prevRevenueAgg[0]?.total || 0;

    const revenueChange = calculateGrowth(revenueFiltered, prevRevenue);

    // ---- SALES GRAPH ----
    const sales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id:
            range === "today"
              ? { $hour: "$createdAt" }
              : { $dayOfMonth: "$createdAt" },
          total: { $sum: "$pricing.amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    let fullRange = [];

    if (range === "today") {
      fullRange = Array.from({ length: 24 }, (_, i) => i);
    } else if (range === "week") {
      const today = new Date();
      fullRange = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return d.getDate();
      });
    } else {
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();

      fullRange = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    }

    // convert aggregation to map
    const salesMap = new Map(sales.map((s) => [Number(s._id), s.total]));

    // fill missing values
    const formattedSales = fullRange.map((key) => ({
      label: key.toString(),
      value: salesMap.get(key) || 0,
    }));
    // ---- RESPONSE ----
    return res.json({
      success: true,
      data: {
        totalUsers: usersCount,
        totalOrders: ordersCount,
        revenue: revenueFiltered,
        usersChange: Number(usersChange.toFixed(2)),
        ordersChange: Number(ordersChange.toFixed(2)),
        revenueChange: Number(revenueChange.toFixed(2)),

        sales: formattedSales,
      },
    });
  } catch (error) {
    console.error("getDashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Dashboard fetch failed",
    });
  }
};

// ADMIN - GET ORDER BY ID
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("ADMIN GET ORDER BY ID ERROR:", error);
    next(error);
  }
};

module.exports = {
  getProviderHealth,
  getReconciliationIssues,
  getFailedJobs,
  getWebhookFailures,
  getOrdersSummary,
  getRevenueSummary,
  getCodOutstanding,
  getWalletBalances,
  getProviderPerformance,
  getUsers,
  getUserById,
  updateUser,
  getOrders,
  getDashboard,
  getOrderById,
};
