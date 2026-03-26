const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");

const {
  getDashboard,
  getUsers,
  getUserById,
  updateUser,
  getProviderHealth,
  getReconciliationIssues,
  getFailedJobs,
  getWebhookFailures,
  getOrdersSummary,
  getRevenueSummary,
  getCodOutstanding,
  getWalletBalances,
  getProviderPerformance,
  getOrders,
  getOrderById,
} = require("../controllers/admin.controller");

// =========================
// MIDDLEWARE
// =========================
router.use(protect);
router.use(allowRoles("admin"));

// =========================
// ANALYTICS
// =========================
router.get("/providers/health", getProviderHealth);
router.get("/reconciliation/issues", getReconciliationIssues);
router.get("/jobs/failed", getFailedJobs);
router.get("/webhooks/failed", getWebhookFailures);
router.get("/analytics/orders-summary", getOrdersSummary);
router.get("/analytics/revenue-summary", getRevenueSummary);
router.get("/analytics/cod-outstanding", getCodOutstanding);
router.get("/analytics/wallet-balances", getWalletBalances);
router.get("/analytics/provider-performance", getProviderPerformance);
router.get("/dashboard", getDashboard);

// =========================
// USERS
// =========================
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);

// =========================
// ORDERS
// =========================
router.get("/orders", getOrders);
router.get("/orders/:id", getOrderById);

module.exports = router;
