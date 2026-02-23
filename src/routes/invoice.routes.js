const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");

const { getInvoiceByOrder } = require("../controllers/invoice.controller");

router.get("/:orderId", protect, getInvoiceByOrder);

module.exports = router;
