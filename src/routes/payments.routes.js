const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { getPaymentMethods } = require("../controllers/payments.controller");

router.get("/", protect, getPaymentMethods);

module.exports = router;
