const express = require("express");
const router = express.Router();
const { orderLimiter } = require("../middlewares/rateLimiter");
const { allowRoles } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createOrderSchema,
  calculateOrderSchema,
} = require("../validators/order.validator");
const protect = require("../middlewares/auth.middleware");

const {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  syncOrder,
  calculateOrder,
  editOrder,
  listProviderOrders,
  getProviderOrder,
  getCourierInfo,
  getClientProfile,
  getBankCards,
  getLabels,
  getTracking,
  getPOD,
  getDocuments,
  getPricingBreakdown,
  getProviderHistory,
  createBulkOrders,
  getPublicTrackingOrder,
} = require("../controllers/orders.controller");

// -----------------------------------------------
// STATIC / NON-PARAM ROUTES FIRST
// -----------------------------------------------

// CREATE
router.post(
  "/create",
  protect,
  orderLimiter,
  validate(createOrderSchema),
  createOrder,
);

// CALCULATE
router.post("/calculate", validate(calculateOrderSchema), calculateOrder);

// BULK
router.post("/bulk", protect, createBulkOrders);

// LIST
router.get("/list", protect, getOrders);

// PUBLIC TRACKING SUMMARY
router.get("/track/:id", getPublicTrackingOrder);

// -----------------------------------------------
// PROVIDER ROUTES — must come before /:id routes
// -----------------------------------------------

router.get("/provider/list", protect, allowRoles("admin"), listProviderOrders);

router.get(
  "/provider/client-profile",
  protect,
  allowRoles("admin"),
  getClientProfile,
);

router.get("/provider/bank-cards", protect, allowRoles("admin"), getBankCards);

router.get("/provider/labels", protect, allowRoles("admin"), getLabels);

router.get(
  "/provider/:orderId",
  protect,
  allowRoles("admin"),
  getProviderOrder,
);

// -----------------------------------------------
// DYNAMIC /:id ROUTES — always last
// -----------------------------------------------

router.get("/:id", protect, getOrderById);

router.get("/:id/courier", protect, getCourierInfo);

router.get("/:id/sync", protect, allowRoles("admin"), syncOrder);

router.get("/:id/history", protect, getProviderHistory);

router.get("/:id/pricing-breakdown", protect, getPricingBreakdown);

router.get("/:id/tracking", protect, getTracking);
router.get("/:id/pod", protect, getPOD);

router.get("/:id/documents", protect, getDocuments);

router.post("/:id/cancel", protect, cancelOrder);

router.post("/:id/edit", protect, editOrder);

module.exports = router;
