const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { invoiceResendLimiter } = require("../middlewares/rateLimiter");

const {
  getInvoiceByOrder,
  downloadInvoice,
  resendInvoiceEmail,
} = require("../controllers/invoice.controller");
router.get("/:orderId/download", protect, downloadInvoice);
router.post("/:orderId/email", protect, invoiceResendLimiter, resendInvoiceEmail);

router.get("/:orderId", protect, getInvoiceByOrder);
module.exports = router;
