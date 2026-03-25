const express = require("express");
const router = express.Router();
const { getDashboard } = require("../controllers/admin.controller");
const {
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
} = require("../controllers/admin.controller");

const allowRoles = require("../middlewares/role.middleware");
const protect = require("../middlewares/auth.middleware");
const { getOrders } = require("../controllers/admin.controller");

router.use(protect);
router.use(allowRoles("admin"));

// analytics
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
// users
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.get("/orders", getOrders);
module.exports = router;
