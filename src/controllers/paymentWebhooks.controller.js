const PaymentIntent = require("../models/PaymentIntent");
const { creditWallet } = require("../services/wallet.service");

const paymentSuccessWebhook = async (req, res) => {
  try {
    const { gatewayOrderId, gatewayPaymentId } = req.body;

    const intent = await PaymentIntent.findOneAndUpdate(
      { gatewayOrderId },
      {
        $set: {
          status: "SUCCESS",
          gatewayPaymentId,
        },
        $push: { statusHistory: { status: "SUCCESS" } },
      },
      { new: true },
    );
    console.log("WEBHOOK INTENT FOUND:", intent);

    // Already processed OR not found
    if (!intent) {
      return res.json({ received: true });
    }

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
