const express = require("express");
const router = express.Router();

const allowRoles = require("../middlewares/role.middleware");

const {
  getProviderHealth,
  getReconciliationIssues,
  getFailedJobs,
  getWebhookFailures,
} = require("../controllers/admin.controller");

router.use(allowRoles("Admin"));

router.get("/providers/health", getProviderHealth);
router.get("/reconciliation/issues", getReconciliationIssues);
router.get("/jobs/failed", getFailedJobs);
router.get("/webhooks/failed", getWebhookFailures);

module.exports = router;
