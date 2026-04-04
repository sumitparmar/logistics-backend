const express = require("express");
const router = express.Router();
const { getPricingAnalytics } = require("../controllers/analytics.controller");
const protect = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const { exportCSV } = require("../controllers/admin.controller");

const {
  getAdminPricing,
  updateAdminPricing,
} = require("../controllers/adminPricing.controller");

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
  updateOrderStatus,
  updateOrdersBulkStatus,
  cancelOrdersBulk,
  cancelOrder,
  getCouriers,
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

router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);

router.get("/orders", getOrders);
router.get("/couriers", getCouriers);

router.put("/orders/bulk/status", updateOrdersBulkStatus);
router.put("/orders/bulk/cancel", cancelOrdersBulk);

router.get("/orders/:id", getOrderById);
router.put("/orders/:id/status", updateOrderStatus);
router.put("/orders/:id/cancel", cancelOrder);

router.get("/pricing", getAdminPricing);
router.post("/pricing", updateAdminPricing);
router.get("/pricing/analytics", getPricingAnalytics);
router.get("/export", exportCSV);

module.exports = router;
