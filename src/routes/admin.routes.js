const express = require("express");
const router = express.Router();

const allowRoles = require("../middlewares/role.middleware");

const {
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

router.use(allowRoles("Admin"));

router.get("/providers/health", getProviderHealth);
router.get("/reconciliation/issues", getReconciliationIssues);
router.get("/jobs/failed", getFailedJobs);
router.get("/webhooks/failed", getWebhookFailures);
router.get("/analytics/orders-summary", getOrdersSummary);
router.get("/analytics/revenue-summary", getRevenueSummary);
router.get("/analytics/cod-outstanding", getCodOutstanding);
router.get("/analytics/wallet-balances", getWalletBalances);
router.get("/analytics/provider-performance", getProviderPerformance);

module.exports = router;
