const PaymentIntent = require("../models/PaymentIntent");
const { creditWallet } = require("../services/wallet.service");

const paymentSuccessWebhook = async (req, res) => {
  try {
    const { gatewayOrderId, gatewayPaymentId } = req.body;

    const intent = await PaymentIntent.findOne({ gatewayOrderId });

    if (!intent) {
      return res.status(404).json({ received: false });
    }

    if (intent.status === "SUCCESS") {
      return res.json({ received: true });
    }

    intent.status = "SUCCESS";
    intent.gatewayPaymentId = gatewayPaymentId;
    intent.statusHistory.push({ status: "SUCCESS" });

    await intent.save();

    // Auto wallet credit
    await creditWallet({
      userId: intent.user,
      amount: intent.amount,
      reason: "PAYMENT_SUCCESS",
      reference: intent._id.toString(),
      metadata: { gateway: intent.gateway },
    });

    return res.json({ received: true });
  } catch (err) {
    console.error("PAYMENT WEBHOOK ERROR:", err);
    return res.json({ received: false });
  }
};

module.exports = { paymentSuccessWebhook };
