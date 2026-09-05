const healthStore = require("../providers/providerHealth.store");
const mongoose = require("mongoose");
const Reconciliation = require("../models/Reconciliation");
const FailedJob = require("../models/failedJob.model");
const User = require("../models/User");
const Order = require("../models/Order");
const AdminRole = require("../models/AdminRole");
const PaymentIntent = require("../models/PaymentIntent");
const Refund = require("../models/Refund");
const adminPermissions = require("../constants/adminPermissions");
const { processDeliveredOrder } = require("../services/invoice.service");
const { creditWallet } = require("../services/wallet.service");
const adminUsersService = require("../services/adminUsers.service");
const ALL_PERMISSIONS = Object.values(adminPermissions).flatMap((module) =>
  Object.values(module),
);
const {
  createAdminNotification,
} = require("../services/adminNotification.service");
const { emitOrderUpdate } = require("../services/realtime.service");
const { getTrackingService } = require("../services/orders.service");
const { reconcileOrders } = require("../services/reconciliation.service");
const { createCustomerNotification } = require("../services/customerNotification.service");
const { getOrderReference } = require("../utils/orderReference");

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
      $match: {
        status: "DELIVERED",
      },
    },
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

const paymentStatusExpression = {
  $switch: {
    branches: [
      {
        case: {
          $or: [
            { $eq: ["$codSettled", true] },
            { $eq: ["$payment.status", "PAID"] },
          ],
        },
        then: "Collected",
      },
      {
        case: {
          $or: [
            { $in: ["$status", ["CANCELLED", "FAILED"]] },
            { $eq: ["$payment.status", "FAILED"] },
          ],
        },
        then: "Failed",
      },
    ],
    default: "Pending",
  },
};

const paymentTypeExpression = {
  $cond: [
    { $eq: ["$cod.enabled", true] },
    "COD",
    {
      $switch: {
        branches: [
          {
            case: {
              $in: [
                "$payment.method",
                ["BANK_CARD", "CARD", "UPI", "QR", "NETBANKING"],
              ],
            },
            then: "ONLINE",
          },
          {
            case: {
              $in: ["$payment.method", ["WALLET", "BALANCE"]],
            },
            then: "WALLET",
          },
        ],
        default: "CASH",
      },
    },
  ],
};

const paymentTypeLabelExpression = {
  $switch: {
    branches: [
      { case: { $eq: ["$_paymentType", "COD"] }, then: "COD Collection" },
      { case: { $eq: ["$_paymentType", "ONLINE"] }, then: "Online Payment" },
      { case: { $eq: ["$_paymentType", "WALLET"] }, then: "Wallet" },
    ],
    default: "Cash",
  },
};

const buildPaymentPipeline = (query = {}) => {
  const search = String(query.search || "").trim();
  const baseFilter = {};

  if (search) {
    const safeSearch = escapeRegex(search);
    baseFilter.$or = [
      { borzoOrderId: { $regex: safeSearch, $options: "i" } },
      { "customer.name": { $regex: safeSearch, $options: "i" } },
      { "customer.phone": { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (query.date) {
    baseFilter.createdAt = {
      $gte: parseAdminOrderDate(query.date),
      $lt: parseAdminOrderDate(query.date, true),
    };
  }

  const stages = [
    { $match: baseFilter },
    {
      $set: {
        _paymentStatus: paymentStatusExpression,
        _paymentType: paymentTypeExpression,
        _paymentAmount: {
          $cond: [
            { $eq: ["$cod.enabled", true] },
            { $ifNull: ["$cod.amount", 0] },
            { $ifNull: ["$pricing.amount", 0] },
          ],
        },
        _customerName: { $ifNull: ["$customer.name", "-"] },
      },
    },
    { $set: { _paymentTypeLabel: paymentTypeLabelExpression } },
  ];

  if (query.status && query.status !== "All") {
    if (!["Pending", "Collected", "Failed"].includes(query.status)) {
      const error = new Error("Invalid payment status filter");
      error.statusCode = 400;
      throw error;
    }
    stages.push({ $match: { _paymentStatus: query.status } });
  }

  if (query.type && query.type !== "All") {
    if (!["COD", "ONLINE", "WALLET", "CASH"].includes(query.type)) {
      const error = new Error("Invalid payment type filter");
      error.statusCode = 400;
      throw error;
    }
    stages.push({
      $match:
        query.type === "COD"
          ? { _paymentType: { $in: ["COD", "CASH"] } }
          : { _paymentType: query.type },
    });
  }

  return stages;
};

const getPayments = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(
      Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10, 1),
      100,
    );
    const sortFields = {
      orderId: "borzoOrderId",
      customer: "_customerName",
      amount: "_paymentAmount",
      status: "_paymentStatus",
      createdAt: "createdAt",
    };
    const sortField = sortFields[req.query.sortBy] || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;
    const stages = buildPaymentPipeline(req.query);

    const [result, refundCount, refundIntentCount] = await Promise.all([
      Order.aggregate([
        ...stages,
        {
          $facet: {
            data: [
              { $sort: { [sortField]: sortOrder, _id: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 0,
                  orderId: { $ifNull: ["$borzoOrderId", "-"] },
                  customer: "$_customerName",
                  amount: "$_paymentAmount",
                  type: "$_paymentTypeLabel",
                  status: "$_paymentStatus",
                  createdAt: 1,
                },
              },
            ],
            metadata: [{ $count: "total" }],
            summary: [
              {
                $group: {
                  _id: null,
                  totalCodOrders: {
                    $sum: 1,
                  },
                  pendingCollection: {
                    $sum: {
                      $cond: [
                        { $eq: ["$_paymentStatus", "Pending"] },
                        "$_paymentAmount",
                        0,
                      ],
                    },
                  },
                  collectedAmount: {
                    $sum: {
                      $cond: [
                        { $eq: ["$_paymentStatus", "Collected"] },
                        "$_paymentAmount",
                        0,
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      ]),
      Refund.countDocuments({ status: "INITIATED" }),
      PaymentIntent.countDocuments({
        status: { $in: ["REFUND_REQUESTED", "REFUND_PROCESSING"] },
      }),
    ]);

    const payload = result[0] || {};
    const summary = payload.summary?.[0] || {};
    const total = payload.metadata?.[0]?.total || 0;

    return res.json({
      success: true,
      data: payload.data || [],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalCodOrders: summary.totalCodOrders || 0,
        pendingCollection: summary.pendingCollection || 0,
        collectedAmount: summary.collectedAmount || 0,
        refundQueue: refundCount + refundIntentCount,
      },
    });
  } catch (error) {
    console.error("getPayments error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to fetch payments",
    });
  }
};

let reconciliationInFlight = false;

const reconcilePayments = async (req, res) => {
  if (reconciliationInFlight) {
    return res.status(409).json({
      success: false,
      message: "Payment reconciliation is already in progress",
    });
  }

  reconciliationInFlight = true;
  try {
    const result = await reconcileOrders();
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("reconcilePayments error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment reconciliation failed",
    });
  } finally {
    reconciliationInFlight = false;
  }
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

const createUser = async (req, res) => {
  try {
    const result = await adminUsersService.createUser(req.body);

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: result.user,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    console.error("createUser error:", error);

    return res.status(400).json({
      success: false,
      message: "Unable to create user.",
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10, 1), 100);
    const search = String(req.query.search || "").trim();

    const skip = (page - 1) * limit;

    const filter = {};

    const status = String(req.query.status || "").toLowerCase();

    if (status && !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status filter",
      });
    }

    if (status === "active") {
      filter.isActive = true;
    }

    if (status === "inactive") {
      filter.isActive = false;
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { phone: { $regex: safeSearch, $options: "i" } },
      ];
    }

    // 🔥 ROLE FILTER (THIS IS THE FIX)
    if (req.query.role) {
      if (!["user", "admin", "business"].includes(req.query.role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role filter",
        });
      }
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

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
    const userId = req.params.id;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const { name, email, role, isActive, adminRoleId } = req.body;
    const updatePayload = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Name must be at least 2 characters",
        });
      }
      updatePayload.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "A valid email is required",
        });
      }
      updatePayload.email = email.trim().toLowerCase();
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be a boolean",
        });
      }
      updatePayload.isActive = isActive;
    }

    if (!Object.keys(updatePayload).length && role === undefined) {
      return res.status(400).json({
        success: false,
        message: "No user changes provided",
      });
    }

    if (role) {
      if (!["user", "admin", "business"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role",
        });
      }

      if (role === "admin" && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Not allowed to assign admin role",
        });
      }

      updatePayload.role = role;

      // admin users can have adminRole
      if (role === "admin") {
        if (adminRoleId && !mongoose.isValidObjectId(adminRoleId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid admin role id",
          });
        }

        if (adminRoleId && !(await AdminRole.exists({ _id: adminRoleId }))) {
          return res.status(404).json({
            success: false,
            message: "Admin role not found",
          });
        }

        updatePayload.adminRole = adminRoleId || null;
      }

      // non-admin users cannot keep adminRole
      if (role !== "admin") {
        updatePayload.adminRole = null;
      }
    }

    if (req.user._id.toString() === userId && isActive === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    if (req.user._id.toString() === userId && role && role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own admin access",
      });
    }

    const user = await User.findByIdAndUpdate(userId, updatePayload, {
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
    return res.status(error.code === 11000 ? 409 : error.statusCode || 400).json({
      success: false,
      message:
        error.code === 11000
          ? "A user already exists with this email"
          : error.message || "Update failed",
    });
  }
};

function calculateGrowth(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

const ADMIN_ORDER_STATUSES = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
];

const normalizeAdminOrderStatuses = (value) => {
  const requested = (Array.isArray(value) ? value : [value])
    .filter((status) => status !== undefined && status !== null && status !== "")
    .map((status) => String(status).toUpperCase());

  const withoutAll = requested.filter((status) => status !== "ALL");

  const expanded = withoutAll.flatMap((status) =>
    status === "IN_PROGRESS"
      ? ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"]
      : [status],
  );

  const invalid = expanded.filter(
    (status) => !ADMIN_ORDER_STATUSES.includes(status),
  );

  if (invalid.length) {
    const error = new Error("Invalid order status filter");
    error.statusCode = 400;
    throw error;
  }

  return [...new Set(expanded)];
};

const parseAdminOrderDate = (value, endOfDay = false) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const error = new Error("Invalid order date filter");
    error.statusCode = 400;
    throw error;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    const error = new Error("Invalid order date filter");
    error.statusCode = 400;
    throw error;
  }

  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

const getOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10, 1), 100);
    const search = (req.query.search || "").trim();
    const statuses = normalizeAdminOrderStatuses(req.query.status);
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

    const baseFilter = {};

    if (fromDate || toDate) {
      baseFilter.createdAt = {};

      if (fromDate) baseFilter.createdAt.$gte = parseAdminOrderDate(fromDate);

      if (toDate) baseFilter.createdAt.$lt = parseAdminOrderDate(toDate, true);
    }

    if (provider) {
      baseFilter.provider = String(provider).trim().toUpperCase();
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      baseFilter.$or = [
        { borzoOrderId: { $regex: safeSearch, $options: "i" } },
        { "customer.name": { $regex: safeSearch, $options: "i" } },
        { "customer.phone": { $regex: safeSearch, $options: "i" } },
      ];
    }

    const filter = { ...baseFilter };
    if (statuses.length) {
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    const [orders, filteredTotal] = await Promise.all([
      Order.find(filter)
        .select(
          "_id borzoOrderId customer pricing status provider payment cod codSettled createdAt courier pickup drop",
        )
        .sort({ [sortField]: sortDirection })
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
      CREATED: 0,
      IN_PROGRESS: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      FAILED: 0,
    };

    statusAggregation.forEach((item) => {
      if (item._id === "CREATED") statusCounts.CREATED = item.count;
      if (item._id === "DELIVERED") statusCounts.DELIVERED = item.count;
      if (item._id === "CANCELLED") statusCounts.CANCELLED = item.count;
      if (item._id === "FAILED") statusCounts.FAILED = item.count;

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
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to fetch orders",
    });
  }
};

const getCouriers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const filter = { "courier.courierId": { $exists: true, $ne: null } };

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { "courier.name": { $regex: safeSearch, $options: "i" } },
        { "courier.surname": { $regex: safeSearch, $options: "i" } },
        { "courier.phone": { $regex: safeSearch, $options: "i" } },
      ];
    }

    const activeStatuses = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"];
    const [result] = await Order.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$courier.courierId",
          name: { $first: "$courier.name" },
          surname: { $first: "$courier.surname" },
          phone: { $first: "$courier.phone" },
          photo: { $first: "$courier.photoUrl" },
          location: { $first: "$courier.location" },
          lastOrderId: { $first: "$_id" },
          lastStatus: { $first: "$status" },
          lastOrderAt: { $first: "$createdAt" },
          totalOrders: { $sum: 1 },
          activeOrders: {
            $sum: { $cond: [{ $in: ["$status", activeStatuses] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] },
          },
        },
      },
      {
        $set: {
          id: "$_id",
          name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$name", ""] },
                  " ",
                  { $ifNull: ["$surname", ""] },
                ],
              },
            },
          },
        },
      },
      { $sort: { activeOrders: -1, lastOrderAt: -1, _id: 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          metadata: [{ $count: "total" }],
        },
      },
    ]);

    const couriers = (result?.data || []).map((courier) => ({
      ...courier,
      name: courier.name || "Unknown Driver",
      phone: courier.phone || "N/A",
      status: courier.activeOrders > 0 ? "ACTIVE" : "IDLE",
    }));
    const total = result?.metadata?.[0]?.total || 0;

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
    const requestedRange = String(req.query.range || "month").toLowerCase();
    const range = ["today", "week", "month"].includes(requestedRange)
      ? requestedRange
      : "month";

    const now = new Date();
    let startDate;
    let prevStartDate;

    if (range === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 1);
    } else if (range === "week") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - 6);
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 7);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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
          deliveredAt: { $gte: startDate },
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
          deliveredAt: { $gte: prevStartDate, $lt: startDate },
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
          deliveredAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id:
            range === "today"
              ? { $hour: "$deliveredAt" }
              : { $dayOfMonth: "$deliveredAt" },

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
      FAILED: 0,
    };

    statusAggregation.forEach((item) => {
      if (item._id === "CREATED") statusCounts.CREATED = item.count;
      if (item._id === "DELIVERED") statusCounts.DELIVERED = item.count;
      if (item._id === "CANCELLED") statusCounts.CANCELLED = item.count;
      if (item._id === "FAILED") statusCounts.FAILED = item.count;

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
        activeOrders: statusCounts.IN_PROGRESS,
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

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    if (!ADMIN_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const { transitionStatus } = require("../engines/status.engine"); // add at top

    const nextStatus = transitionStatus(order.status, status);
    if (nextStatus !== status && status !== order.status) {
      return res.status(409).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}`,
      });
    }

    const previousStatus = order.status;
    order.status = nextStatus;
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

    if (savedOrder.status === "DELIVERED") {
      await processDeliveredOrder(savedOrder);
    }

    if (previousStatus !== savedOrder.status && savedOrder.user) {
      await createCustomerNotification({
        user: savedOrder.user,
        order: savedOrder._id,
        type: savedOrder.status === "DELIVERED" ? "ORDER_DELIVERED" : "ORDER_STATUS",
        title: savedOrder.status === "DELIVERED" ? "Order Delivered" : "Order Update",
        message: `Your order #${getOrderReference(savedOrder.borzoOrderId)} is now ${String(savedOrder.status).replace(/_/g, " ").toLowerCase()}.`,
        priority: savedOrder.status === "CANCELLED" ? "HIGH" : "MEDIUM",
      });
    }

    emitOrderUpdate(savedOrder.user, savedOrder, { admin: true });

    //  END

    res.json({
      success: true,
      data: savedOrder,
    });
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ message: "Unable to update order status." });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (["DELIVERED", "CANCELLED"].includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: "This order can no longer be cancelled",
      });
    }

    order.status = "CANCELLED";
    order.cancelledAt = new Date();

    const savedOrder = await order.save();

    if (savedOrder.user) {
      await createCustomerNotification({
        user: savedOrder.user,
        order: savedOrder._id,
        type: "ORDER_CANCELLED",
        title: "Order Cancelled",
        message: `Your order #${getOrderReference(savedOrder.borzoOrderId)} has been cancelled by support.`,
        priority: "HIGH",
      });
    }

    emitOrderUpdate(savedOrder.user, savedOrder, { admin: true });

    res.json({
      success: true,
      data: savedOrder,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const updateOrdersBulkStatus = async (req, res) => {
  try {
    const { orderIds: requestedOrderIds, status } = req.body;

    // VALIDATION
    if (!Array.isArray(requestedOrderIds) || !requestedOrderIds.length) {
      return res.status(400).json({
        success: false,
        message: "No orders provided",
      });
    }

    const orderIds = [...new Set(requestedOrderIds.map((id) => String(id)))];
    if (orderIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const allowedStatuses = ADMIN_ORDER_STATUSES.filter(
      (value) => value !== "CANCELLED" && value !== "FAILED",
    );

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
    const allowedCurrentStatuses = {
      CREATED: ["CREATED"],
      ASSIGNED: ["CREATED", "ASSIGNED"],
      PICKED_UP: ["CREATED", "ASSIGNED", "PICKED_UP"],
      IN_TRANSIT: ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"],
      DELIVERED: ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"],
    };

    const result = await Order.updateMany(
      {
        _id: { $in: orderIds },
        status: { $in: allowedCurrentStatuses[status] },
      },
      { $set: updatePayload },
    );

    //  GET SUCCESS / FAILURE SPLIT
    const updatedOrders = await Order.find({
      _id: { $in: orderIds },
      status: status,
    });

    if (status === "DELIVERED") {
      await Promise.all(updatedOrders.map((order) => processDeliveredOrder(order)));
    }

    updatedOrders.forEach((order) => {
      emitOrderUpdate(order.user, order, { admin: true });
    });

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
    const { orderIds: requestedOrderIds } = req.body;

    if (!Array.isArray(requestedOrderIds) || !requestedOrderIds.length) {
      return res.status(400).json({
        success: false,
        message: "No orders provided",
      });
    }

    const orderIds = [...new Set(requestedOrderIds.map((id) => String(id)))];
    if (orderIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
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
    }).select("_id user status");

    const updatedIdSet = new Set(updatedOrders.map((o) => o._id.toString()));

    const failedIds = orderIds.filter((id) => !updatedIdSet.has(id.toString()));

    updatedOrders.forEach((order) => {
      emitOrderUpdate(order.user, order, { admin: true });
    });

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
    if (
      String(req.query.exportType || req.query.type || "").toLowerCase() ===
      "payments"
    ) {
      const paymentOrders = await Order.aggregate([
        ...buildPaymentPipeline(req.query),
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: 10000 },
        {
          $project: {
            _id: 0,
            Order_ID: { $ifNull: ["$borzoOrderId", ""] },
            Customer: "$_customerName",
            Amount: "$_paymentAmount",
            Type: "$_paymentTypeLabel",
            Status: "$_paymentStatus",
            Created_At: "$createdAt",
          },
        },
      ]);

      const parser = new Parser();
      const csv = parser.parse(paymentOrders);
      res.header("Content-Type", "text/csv");
      res.attachment(`payments-${Date.now()}.csv`);
      return res.send(csv);
    }

    const { search = "", status, fromDate, toDate, provider } = req.query;
    const filter = {};

    if (fromDate) filter.createdAt = { $gte: parseAdminOrderDate(fromDate) };
    if (toDate) {
      filter.createdAt = {
        ...(filter.createdAt || {}),
        $lt: parseAdminOrderDate(toDate, true),
      };
    }

    if (provider) filter.provider = String(provider).trim().toUpperCase();

    if (search) {
      const safeSearch = escapeRegex(String(search).trim());
      filter.$or = [
        { borzoOrderId: { $regex: safeSearch, $options: "i" } },
        { "customer.name": { $regex: safeSearch, $options: "i" } },
        { "customer.phone": { $regex: safeSearch, $options: "i" } },
      ];
    }

    const statuses = normalizeAdminOrderStatuses(status);
    if (statuses.length) {
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    const rawOrderIds = req.query.orderIds
      ? Array.isArray(req.query.orderIds)
        ? req.query.orderIds
        : String(req.query.orderIds).split(",")
      : [];

    if (rawOrderIds.length) {
      const orderIds = [...new Set(rawOrderIds.map((id) => String(id).trim()))];
      if (orderIds.some((id) => !mongoose.isValidObjectId(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid order id",
        });
      }
      filter._id = { $in: orderIds };
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

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
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : "Export failed",
    });
  }
};

const getCourierOrders = async (req, res) => {
  try {
    const courierId = Number(req.params.courierId);
    if (!Number.isSafeInteger(courierId)) {
      return res.status(400).json({ success: false, message: "Invalid courier id" });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 100);
    const skip = (page - 1) * limit;
    const filter = { "courier.courierId": courierId };

    if (req.query.status && req.query.status !== "ALL") {
      const statuses = normalizeAdminOrderStatuses(req.query.status);
      if (statuses.length) filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select("_id courier status createdAt pickup drop")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: orders,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("getCourierOrders error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to fetch courier orders",
    });
  }
};

const getCourierTracking = async (req, res) => {
  try {
    const data = await getTrackingService(req.params.id, null);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to fetch courier tracking",
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

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeRolePayload = (body = {}) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const permissions = Array.isArray(body.permissions)
    ? [
        ...new Set(
          body.permissions
            .filter((permission) => typeof permission === "string")
            .map((permission) => permission.trim())
            .filter(Boolean),
        ),
      ]
    : [];

  if (!name) {
    const error = new Error("Role name is required");
    error.statusCode = 400;
    throw error;
  }

  if (name.length < 2 || name.length > 80) {
    const error = new Error("Role name must be between 2 and 80 characters");
    error.statusCode = 400;
    throw error;
  }

  if (description.length > 300) {
    const error = new Error("Role description cannot exceed 300 characters");
    error.statusCode = 400;
    throw error;
  }

  return { name, description, permissions };
};

// GET ROLES
const getAdminRoles = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10, 1), 100);
    const search = String(req.query.search || "").trim();

    const skip = (page - 1) * limit;

    const filter = search
      ? { name: { $regex: escapeRegex(search), $options: "i" } }
      : {};

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
    const { name, description, permissions } = normalizeRolePayload(req.body);

    // 🔴 Duplicate check
    const exists = await AdminRole.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
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
      message: "Unable to create role.",
    });
  }
};

// UPDATE ROLE

const updateAdminRole = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role id",
      });
    }

    const { name, description, permissions } = normalizeRolePayload(req.body);

    // 🔴 Duplicate check (exclude current)
    const exists = await AdminRole.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
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
      { new: true, runValidators: true },
    );

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    return res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("updateAdminRole error:", error);
    return res.status(400).json({
      success: false,
      message: "Unable to update role.",
    });
  }
};

// DELETE ROLE

const deleteAdminRole = async (req, res) => {
  try {
    const roleId = req.params.id;

    if (!mongoose.isValidObjectId(roleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role id",
      });
    }

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

    const deletedRole = await AdminRole.findByIdAndDelete(roleId);

    if (!deletedRole) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    return res.json({
      success: true,
      message: "Role deleted",
    });
  } catch (error) {
    console.error("deleteAdminRole error:", error);
    return res.status(400).json({
      success: false,
      message: "Unable to delete role.",
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

    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(roleId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user or role id",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin" && !user.adminRole) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify super admin role",
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

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin" && !user.adminRole) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify super admin",
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
  getPayments,
  reconcilePayments,
  getWalletBalances,
  getProviderPerformance,
  getUsers,
  createUser,
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
  getCourierOrders,
  getCourierTracking,
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
