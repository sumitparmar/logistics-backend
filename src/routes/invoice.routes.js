const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");

const {
  getInvoiceByOrder,
  downloadInvoice,
} = require("../controllers/invoice.controller");
router.get("/:orderId/download", protect, downloadInvoice);

router.get("/:orderId", protect, getInvoiceByOrder);
module.exports = router;
