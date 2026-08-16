const express = require("express");
const router = express.Router();

const {
  getSettings,
  updateSettings,
  getSettingsAuditLogs,
  getPublicSettingsStatus,
} = require("../controllers/adminSettings.controller");

const protect = require("../middlewares/auth.middleware");
const {
  allowRoles,
  allowPermissions,
} = require("../middlewares/role.middleware");

const PERMISSIONS = require("../constants/adminPermissions");
const {
  getAdminInvoice,
  downloadAdminInvoice,
  resendAdminInvoice,
} = require("../controllers/adminInvoice.controller");

const { getPricingAnalytics } = require("../controllers/analytics.controller");

const {
  fetchAdminNotifications,
  markAdminNotificationAsRead,
  createTestNotification,
} = require("../controllers/adminNotification.controller");

const {
  getAdminRoles,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  getAdminPermissions,
  exportCSV,
} = require("../controllers/admin.controller");

const {
  getSupportTickets,
  getSupportTicketById,
  replyToSupportTicket,
  updateSupportTicketStatus,
  createSupportTicket,
  getSupportTicketCounts,
} = require("../controllers/adminSupport.controller");

const {
  listApplications: listDriverOnboardingApplications,
  updateApplicationStatus: updateDriverOnboardingStatus,
} = require("../controllers/driverOnboarding.controller");

const {
  getAdminPricing,
  updateAdminPricing,
} = require("../controllers/adminPricing.controller");

const {
  getDashboard,
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
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
  assignRoleToUser,
  removeRoleFromUser,
} = require("../controllers/admin.controller");

// =========================
// GLOBAL MIDDLEWARE
// =========================
router.get("/public/settings-status", getPublicSettingsStatus);
router.use(protect);

// =========================
// ANALYTICS
// =========================
router.get(
  "/providers/health",
  allowPermissions("orders.read"),
  getProviderHealth,
);
router.get(
  "/reconciliation/issues",
  allowPermissions("orders.read"),
  getReconciliationIssues,
);
router.get("/jobs/failed", allowPermissions("orders.read"), getFailedJobs);
router.get(
  "/webhooks/failed",
  allowPermissions("orders.read"),
  getWebhookFailures,
);

router.get(
  "/dashboard",
  allowPermissions(PERMISSIONS.USERS.READ),
  getDashboard,
);

router.get(
  "/analytics/orders-summary",
  allowPermissions("orders.read"),
  getOrdersSummary,
);
router.get(
  "/analytics/revenue-summary",
  allowPermissions("payments.read"),
  getRevenueSummary,
);
router.get(
  "/analytics/cod-outstanding",
  allowPermissions("payments.read"),
  getCodOutstanding,
);
router.get(
  "/analytics/wallet-balances",
  allowPermissions("payments.read"),
  getWalletBalances,
);
router.get(
  "/analytics/provider-performance",
  allowPermissions("orders.read"),
  getProviderPerformance,
);

// =========================
// USERS
// =========================
router.get("/users", allowPermissions(PERMISSIONS.USERS.READ), getUsers);
router.post("/users", allowPermissions(PERMISSIONS.USERS.CREATE), createUser);
router.get("/users/:id", allowPermissions("users.read"), getUserById);
router.put("/users/:id", allowPermissions("users.update"), updateUser);
router.delete("/users/:id", allowPermissions("users.delete"), deleteUser);

router.post(
  "/users/assign-role",
  allowPermissions("users.update"),
  assignRoleToUser,
);

router.patch(
  "/users/:id/remove-role",
  allowPermissions("users.update"),
  removeRoleFromUser,
);

// =========================
// ORDERS (FIXED ORDER)
// =========================

//  BULK ROUTES FIRST (MOST SPECIFIC)
router.put(
  "/orders/bulk/status",
  allowPermissions("orders.update"),
  updateOrdersBulkStatus,
);

router.put(
  "/orders/bulk/cancel",
  allowPermissions("orders.cancel"),
  cancelOrdersBulk,
);

// NORMAL LIST
router.get("/orders", allowPermissions("orders.read"), getOrders);

// SINGLE ORDER ROUTES
router.get("/orders/:id", allowPermissions("orders.read"), getOrderById);

router.put(
  "/orders/:id/status",
  allowPermissions("orders.update"),
  updateOrderStatus,
);

router.put(
  "/orders/:id/cancel",
  allowPermissions("orders.cancel"),
  cancelOrder,
);

// =========================
// COURIERS
// =========================
router.get("/couriers", allowPermissions("drivers.read"), getCouriers);
router.get(
  "/driver-onboarding",
  allowPermissions("drivers.read"),
  listDriverOnboardingApplications,
);

// =========================
// INVOICES
// =========================
router.get(
  "/invoices/:orderId",
  allowPermissions("orders.read"),
  getAdminInvoice,
);
router.get(
  "/invoices/:orderId/download",
  allowPermissions("orders.read"),
  downloadAdminInvoice,
);
router.post(
  "/invoices/:orderId/email",
  allowPermissions("orders.update"),
  resendAdminInvoice,
);
router.put(
  "/driver-onboarding/:id/status",
  allowPermissions("drivers.update"),
  updateDriverOnboardingStatus,
);

// =========================
// PRICING
// =========================
router.get("/pricing", allowPermissions("pricing.read"), getAdminPricing);
router.post("/pricing", allowPermissions("pricing.update"), updateAdminPricing);
router.get(
  "/pricing/analytics",
  allowPermissions("pricing.read"),
  getPricingAnalytics,
);

// =========================
// EXPORT
// =========================
router.get("/export", allowPermissions("orders.read"), exportCSV);

// =========================
// NOTIFICATIONS
// =========================
router.get(
  "/notifications",
  allowPermissions("notifications.read"),
  fetchAdminNotifications,
);
router.patch(
  "/notifications/:id/read",
  allowPermissions("notifications.update"),
  markAdminNotificationAsRead,
);
router.post(
  "/notifications/test",
  allowPermissions("notifications.create"),
  createTestNotification,
);

// =========================
// SUPPORT
// =========================
router.get(
  "/support/tickets",
  allowPermissions("support.read"),
  getSupportTickets,
);
router.get(
  "/support/tickets/count",
  allowPermissions("support.read"),
  getSupportTicketCounts,
);
router.get(
  "/support/tickets/:id",
  allowPermissions("support.read"),
  getSupportTicketById,
);
router.post(
  "/support/tickets/:id/reply",
  allowPermissions("support.reply"),
  replyToSupportTicket,
);
router.patch(
  "/support/tickets/:id/status",
  allowPermissions("support.update"),
  updateSupportTicketStatus,
);
router.post(
  "/support/tickets",
  allowPermissions("support.create"),
  createSupportTicket,
);

// =========================
// ROLES (RBAC)
// =========================
router.get("/roles", allowPermissions("users.read"), getAdminRoles);
router.post("/roles", allowPermissions("users.create"), createAdminRole);
router.put("/roles/:id", allowPermissions("users.update"), updateAdminRole);
router.delete("/roles/:id", allowPermissions("users.delete"), deleteAdminRole);
router.get("/permissions", allowPermissions("users.read"), getAdminPermissions);

// SETTINGS

router.get("/settings", allowPermissions("settings.read"), getSettings);

router.get(
  "/settings/audit",
  allowPermissions("settings.read"),
  getSettingsAuditLogs,
);

router.put("/settings", allowPermissions("settings.update"), updateSettings);

module.exports = router;
