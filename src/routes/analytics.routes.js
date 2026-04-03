const express = require("express");
const router = express.Router();

const { getPricingAnalytics } = require("../controllers/analytics.controller");

const {
  getRevenueSummary,
  getProviderBreakdown,
  getDailyOrders,
  getOrderSummary,
  getVehicleBreakdown,
} = require("../controllers/analytics.controller");
const protect = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");

router.get("/orders/summary", protect, allowRoles("Admin"), getOrderSummary);
router.get("/daily-orders", protect, getDailyOrders);
router.get("/revenue/summary", protect, getRevenueSummary);
router.get("/providers", protect, allowRoles("Admin"), getProviderBreakdown);
router.get("/vehicles", protect, allowRoles("Admin"), getVehicleBreakdown);

router.get("/admin/pricing/analytics", protect, getPricingAnalytics);

module.exports = router;
