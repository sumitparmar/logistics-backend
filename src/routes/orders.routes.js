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
} = require("../controllers/orders.controller");

// CREATE
router.post(
  "/create",
  protect,
  orderLimiter,
  validate(createOrderSchema),
  createOrder,
);

// LIST
router.get("/list", protect, getOrders);

// SINGLE
// router.get("/:id", protect, getOrderById);
router.get("/:id", protect, getOrderById);
router.get("/:id/courier", protect, getCourierInfo);

// ACTIONS
router.post("/:id/cancel", protect, cancelOrder);

router.get("/:id/sync", protect, allowRoles("admin"), syncOrder);
router.post("/calculate", validate(calculateOrderSchema), calculateOrder);

router.post("/:id/edit", protect, editOrder);
router.post("/bulk", protect, createBulkOrders);
router.get("/:id/history", protect, getProviderHistory);

router.get("/:id/pricing-breakdown", protect, getPricingBreakdown);

// PROVIDER
router.get("/provider/list", protect, allowRoles("admin"), listProviderOrders);

router.get(
  "/provider/client-profile",
  protect,
  allowRoles("admin"),
  getClientProfile,
);

router.get("/provider/bank-cards", protect, allowRoles("admin"), getBankCards);

router.get("/provider/labels", protect, allowRoles("admin"), getLabels);

router.get("/:id/tracking", getTracking);

router.get("/:id/pod", protect, getPOD);

router.get("/:id/documents", protect, getDocuments);

router.get(
  "/provider/:orderId",
  protect,
  allowRoles("admin"),
  getProviderOrder,
);

module.exports = router;
