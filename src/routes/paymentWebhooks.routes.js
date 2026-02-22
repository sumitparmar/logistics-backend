const express = require("express");
const router = express.Router();

const {
  paymentSuccessWebhook,
} = require("../controllers/paymentWebhooks.controller");

const { completeRefund } = require("../services/refund.service");

/**
 * Payment success webhook
 */
router.post("/success", paymentSuccessWebhook);

/**
 * Refund success webhook
 */
router.post("/refund-success", async (req, res) => {
  try {
    const { gatewayOrderId } = req.body;

    await completeRefund({
      gatewayOrderId,
    });

    return res.json({ received: true });
  } catch (err) {
    console.error("REFUND WEBHOOK ERROR:", err.message);
    return res.json({ received: true });
  }
});

module.exports = router;
