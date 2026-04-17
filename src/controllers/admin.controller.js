const healthStore = require("../providers/providerHealth.store");
const Reconciliation = require("../models/Reconciliation");
const FailedJob = require("../models/failedJob.model");
const User = require("../models/User");
const Order = require("../models/Order");
const AdminRole = require("../models/AdminRole");
const adminPermissions = require("../constants/adminPermissions");
const ALL_PERMISSIONS = Object.values(adminPermissions).flatMap((module) =>
  Object.values(module),
);
const {
  createAdminNotification,
} = require("../services/adminNotification.service");

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

    const filter = {};

    const status = req.query.status;

    if (status === "active") {
      filter.isActive = true;
    }

    if (status === "inactive") {
      filter.isActive = false;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // 🔥 ROLE FILTER (THIS IS THE FIX)
    if (req.query.role) {
      filter.role = req.query.role;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .populate("adminRole", "name permissions")
        .select(
          "name email phone role adminRole isActive isEmailVerified isPhoneVerified authProvider lastLoginAt createdAt",
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
    const user = await User.findById(req.params.id)
      .populate("adminRole", "name permissions")
      .select("-password");

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
    const { name, email, role, isActive, adminRoleId } = req.body;
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

      // admin users can have adminRole
      if (role === "admin") {
        updatePayload.adminRole = adminRoleId || null;
      }

      // non-admin users cannot keep adminRole
      if (role !== "admin") {
        updatePayload.adminRole = null;
      }
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
    const { fromDate, toDate, provider } = req.query;
    const sortBy = req.query.sortBy || "createdAt";
    // const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const allowedSortFields = [
      "createdAt",
      "pricing.amount",
      "status",
      "borzoOrderId",
    ];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

    const sortDirection = req.query.sortOrder === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;

    let filter = {};

    // DATE FILTER (SAFE ADDITION)
    if (fromDate || toDate) {
      filter.createdAt = {};

      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }

      if (toDate) {
        filter.createdAt.$lte = new Date(toDate);
      }
    }

    // PROVIDER FILTER (SAFE ADDITION)
    if (provider) {
      filter.provider = provider;
    }

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
        filter.status = { $in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] };
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
        .select(
          "_id borzoOrderId customer pricing status provider createdAt courier pickup drop",
        )
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),

      Order.countDocuments(filter), // for table
      Order.countDocuments({}), // for ALL count (no filter)
    ]);

    const statusAggregation = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {
      CREATED: 0,
      IN_PROGRESS: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    statusAggregation.forEach((item) => {
      if (item._id === "CREATED") statusCounts.CREATED = item.count;
      if (item._id === "DELIVERED") statusCounts.DELIVERED = item.count;
      if (item._id === "CANCELLED") statusCounts.CANCELLED = item.count;

      if (
        item._id === "ASSIGNED" ||
        item._id === "PICKED_UP" ||
        item._id === "IN_TRANSIT"
      ) {
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

const getCouriers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    // ✅ Only active orders with courier assigned
    const filter = {
      status: { $nin: ["DELIVERED", "CANCELLED"] },
      courier: { $ne: null },
    };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select("_id courier status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Order.countDocuments(filter),
    ]);

    // 🔁 Transform → unique couriers
    const couriersMap = new Map();

    orders.forEach((order) => {
      if (order.courier?.courier_id) {
        couriersMap.set(order.courier.courier_id, {
          id: order.courier.courier_id,
          name: order.courier.name || "N/A",
          phone: order.courier.phone || "N/A",
          status: order.status,
          orderId: order._id,
        });
      }
    });

    const couriers = Array.from(couriersMap.values());

    return res.json({
      success: true,
      data: couriers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getCouriers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch couriers",
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
      prevStartDate = new Date(startDate);
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    }

    if (range === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "week") {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }

    // ---- TOTAL (ALL TIME - keep same as before) ----
    const [totalUsers, totalOrders, revenueAgg] = await Promise.all([
      User.countDocuments({
        isActive: true,
      }),

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
      isActive: true,
    });

    const prevUsersCount = await User.countDocuments({
      createdAt: {
        $gte: prevStartDate,
        $lt: startDate,
      },
      isActive: true,
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
      {
        $match: {
          status: "DELIVERED",
          createdAt: { $gte: startDate },
        },
      },
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
          status: "DELIVERED",
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
          status: "DELIVERED",
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

    const statusAggregation = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
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
    const salesMap = new Map(
      sales.map((s) => [
        typeof s._id === "object" ? s._id.day || s._id.hour : s._id,
        s.total,
      ]),
    );
    // fill missing values
    const formattedSales = fullRange.map((key) => ({
      label: key.toString(),
      value: salesMap.get(key) || 0,
    }));

    const statusCounts = {
      CREATED: 0,
      IN_PROGRESS: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    statusAggregation.forEach((item) => {
      if (item._id === "CREATED") statusCounts.CREATED = item.count;
      if (item._id === "DELIVERED") statusCounts.DELIVERED = item.count;
      if (item._id === "CANCELLED") statusCounts.CANCELLED = item.count;

      if (
        item._id === "ASSIGNED" ||
        item._id === "PICKED_UP" ||
        item._id === "IN_TRANSIT"
      ) {
        statusCounts.IN_PROGRESS += item.count;
      }
    });

    // ---- RESPONSE ----
    return res.json({
      success: true,
      data: {
        totalUsers: totalUsers,
        totalOrders: totalOrders,
        revenue: revenueFiltered,
        usersChange: Number(usersChange.toFixed(2)),
        ordersChange: Number(ordersChange.toFixed(2)),
        revenueChange: Number(revenueChange.toFixed(2)),
        sales: formattedSales,
        statusCounts,
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

const { getIO } = require("../config/socket"); // add at top if missing

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const { transitionStatus } = require("../engines/status.engine"); // add at top

    order.status = transitionStatus(order.status, status);
    if (status === "ASSIGNED") order.assignedAt = new Date();
    if (status === "PICKED_UP") order.pickedAt = new Date();
    let isNewlyDelivered = false;

    if (status === "DELIVERED" && !order.deliveredAt) {
      order.deliveredAt = new Date();
      isNewlyDelivered = true;
    }

    const savedOrder = await order.save();

    if (isNewlyDelivered) {
      await createAdminNotification({
        type: "ORDER",
        title: "Order Delivered",
        message: `Order ${savedOrder._id} delivered successfully`,
        meta: { orderId: savedOrder._id },
        priority: "LOW",
      });
    }

    const io = getIO();

    io.to(`user:${savedOrder.user}`).emit("order-status-update", {
      orderId: savedOrder._id,
      status: savedOrder.status,
    });

    io.to("admin").emit("admin-order-update", {
      orderId: savedOrder._id,
      status: savedOrder.status,
      data: savedOrder,
    });

    //  END

    res.json({
      success: true,
      data: savedOrder,
    });
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = "CANCELLED";
    order.cancelledAt = new Date();

    await order.save();

    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const updateOrdersBulkStatus = async (req, res) => {
  try {
    const { orderIds, status } = req.body;

    // VALIDATION
    if (!orderIds || !orderIds.length) {
      return res.status(400).json({
        success: false,
        message: "No orders provided",
      });
    }

    const allowedStatuses = [
      "CREATED",
      "ASSIGNED",
      "PICKED_UP",
      "IN_TRANSIT",
      "DELIVERED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    //  TIMESTAMP HANDLING
    let updatePayload = { status };

    if (status === "ASSIGNED") updatePayload.assignedAt = new Date();
    if (status === "PICKED_UP") updatePayload.pickedAt = new Date();
    if (status === "DELIVERED") {
      updatePayload.deliveredAt = new Date();
    }
    //  BULK UPDATE
    const result = await Order.updateMany(
      {
        _id: { $in: orderIds },
        status: { $nin: ["DELIVERED", "CANCELLED"] },
      },
      { $set: updatePayload },
    );

    //  GET SUCCESS / FAILURE SPLIT
    const updatedOrders = await Order.find({
      _id: { $in: orderIds },
      status: status,
    }).select("_id");

    const updatedIdSet = new Set(updatedOrders.map((o) => o._id.toString()));

    const failedIds = orderIds.filter((id) => !updatedIdSet.has(id.toString()));

    //  FINAL RESPONSE
    res.json({
      success: true,
      totalRequested: orderIds.length,
      modifiedCount: result.modifiedCount,
      failedIds,
    });
  } catch (error) {
    console.error("Bulk status update failed", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const cancelOrdersBulk = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !orderIds.length) {
      return res.status(400).json({
        success: false,
        message: "No orders provided",
      });
    }

    //  BULK CANCEL WITH TIMESTAMP
    const result = await Order.updateMany(
      {
        _id: { $in: orderIds },
        status: { $nin: ["DELIVERED", "CANCELLED"] },
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      },
    );

    //  GET SUCCESS / FAILURE SPLIT
    const updatedOrders = await Order.find({
      _id: { $in: orderIds },
      status: "CANCELLED",
    }).select("_id");

    const updatedIdSet = new Set(updatedOrders.map((o) => o._id.toString()));

    const failedIds = orderIds.filter((id) => !updatedIdSet.has(id.toString()));

    res.json({
      success: true,
      totalRequested: orderIds.length,
      modifiedCount: result.modifiedCount,
      failedIds,
    });
  } catch (error) {
    console.error("Bulk cancel failed", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const { Parser } = require("json2csv");

const exportCSV = async (req, res) => {
  try {
    const orders = await Order.find().lean();

    const rows = orders.map((o) => ({
      Order_ID: o.borzoOrderId || "",
      Customer: o.customer?.name || "",
      Amount: o.pricing?.amount || 0,
      Status: o.status,
      Created_At: o.createdAt,
      Delivered_At: o.deliveredAt || "",
    }));

    const parser = new Parser();
    const csv = parser.parse(rows);

    res.header("Content-Type", "text/csv");
    res.attachment(`orders-${Date.now()}.csv`);

    return res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    return res.status(500).json({
      success: false,
      message: "Export failed",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isActive: false,
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const io = getIO();
    io.to("admin").emit("admin-user-update");

    return res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("deleteUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
};

// ROLES (ADMIN RBAC)

// GET ROLES
const getAdminRoles = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    const filter = search ? { name: { $regex: search, $options: "i" } } : {};

    const [roles, total] = await Promise.all([
      AdminRole.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),

      AdminRole.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: roles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getAdminRoles error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
    });
  }
};

// CREATE ROLE
const createAdminRole = async (req, res) => {
  try {
    const { name, description, permissions = [] } = req.body;

    // 🔴 Duplicate check
    const exists = await AdminRole.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Role already exists",
      });
    }

    // 🔴 Permission validation
    const invalidPermissions = permissions.filter(
      (p) => !ALL_PERMISSIONS.includes(p),
    );

    if (invalidPermissions.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid permissions detected",
      });
    }

    const role = await AdminRole.create({
      name: name.trim(),
      description,
      permissions,
    });

    return res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("createAdminRole error:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE ROLE

const updateAdminRole = async (req, res) => {
  try {
    const { name, description, permissions = [] } = req.body;

    // 🔴 Duplicate check (exclude current)
    const exists = await AdminRole.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      _id: { $ne: req.params.id },
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Role already exists",
      });
    }

    // 🔴 Permission validation
    const invalidPermissions = permissions.filter(
      (p) => !ALL_PERMISSIONS.includes(p),
    );

    if (invalidPermissions.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid permissions detected",
      });
    }

    const role = await AdminRole.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        description,
        permissions,
      },
      { new: true },
    );

    return res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("updateAdminRole error:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE ROLE

const deleteAdminRole = async (req, res) => {
  try {
    const roleId = req.params.id;

    // 🔴 Check if role is assigned to users
    const usersUsingRole = await User.countDocuments({
      adminRole: roleId,
    });

    if (usersUsingRole > 0) {
      return res.status(400).json({
        success: false,
        message: "Role is assigned to users",
      });
    }

    await AdminRole.findByIdAndDelete(roleId);

    return res.json({
      success: true,
      message: "Role deleted",
    });
  } catch (error) {
    console.error("deleteAdminRole error:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getAdminPermissions = (req, res) => {
  return res.json({
    success: true,
    data: adminPermissions,
  });
};

// =========================
// USER ROLE ASSIGNMENT
// =========================

// ASSIGN ROLE TO USER
const assignRoleToUser = async (req, res) => {
  try {
    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({
        success: false,
        message: "userId and roleId are required",
      });
    }

    const user = await User.findById(userId);

    if (user.role === "admin" && !user.adminRole) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify super admin role",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Only admins can have adminRole
    if (user.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "Only admin users can have roles",
      });
    }

    const role = await AdminRole.findById(roleId);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    user.adminRole = roleId;
    await user.save();

    const updatedUser = await User.findById(userId).populate(
      "adminRole",
      "name _id",
    );

    return res.json({
      success: true,
      message: "Role assigned successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("assignRoleToUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign role",
    });
  }
};

// REMOVE ROLE FROM USER
const removeRoleFromUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);

    if (user.role === "admin" && !user.adminRole) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify super admin",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.adminRole = null;
    await user.save();

    const updatedUser = await User.findById(userId).populate(
      "adminRole",
      "name _id",
    );

    return res.json({
      success: true,
      message: "Role removed successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("removeRoleFromUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove role",
    });
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
  updateOrderStatus,
  cancelOrder,
  updateOrdersBulkStatus,
  cancelOrdersBulk,
  getCouriers,
  exportCSV,
  deleteUser,
  getAdminRoles,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  getAdminPermissions,
  assignRoleToUser,
  removeRoleFromUser,
};
