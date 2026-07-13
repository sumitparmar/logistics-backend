const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");

const {
  getPaymentMethods,
  payIn,
  payOut,
  getWalletBalance,
  getWalletSummary,
  getLedger,
  downloadStatement,
  createPaymentIntentAndGatewayOrder,
  refundPayment,
} = require("../controllers/payments.controller");

// STATIC
router.get("/", protect, getPaymentMethods);

// WALLET
router.get("/wallet", protect, getWalletBalance);

router.get("/summary", protect, getWalletSummary);

router.get("/ledger", protect, getLedger);
router.get("/statement", protect, downloadStatement);

// TRANSACTIONS
router.post("/payin", protect, payIn);
router.post("/payout", protect, payOut);
router.post("/intent", protect, createPaymentIntentAndGatewayOrder);
router.post("/refund", protect, refundPayment);

module.exports = router;
