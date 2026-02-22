const healthStore = require("../providers/providerHealth.store");
const Reconciliation = require("../models/Reconciliation");
const FailedJob = require("../models/failedJob.model");

// Provider health only
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

const Order = require("../models/Order");
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
};
