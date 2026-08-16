const PaymentIntent = require("../models/PaymentIntent");
const { creditWallet } = require("../services/wallet.service");
const { markSuccess } = require("../services/paymentIntent.service");
const crypto = require("crypto");

const verifyRazorpayWebhook = (req) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const signature = req.headers["x-razorpay-signature"];
  const body = req.rawBody || JSON.stringify(req.body);

  if (!signature || !body) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const signatureBuffer = Buffer.from(String(signature));
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
};

const paymentSuccessWebhook = async (req, res) => {
  try {
    if (!verifyRazorpayWebhook(req)) {
      return res.status(401).json({ received: false });
    }

    const payload = req.body?.payload?.payment?.entity || req.body || {};
    const gatewayOrderId = payload.order_id || payload.gatewayOrderId;
    const gatewayPaymentId = payload.id || payload.gatewayPaymentId;
    const existing = await PaymentIntent.findOne({
      gatewayOrderId,
      status: "PROCESSING",
    });

    const intent = existing
      ? await markSuccess({
          intentId: existing._id,
          gatewayPaymentId,
          metadata: {
            ...(existing.metadata || {}),
            gateway: "RAZORPAY",
            source: "WEBHOOK",
          },
        })
      : null;

    // Already processed OR not found
    if (!intent) {
      return res.json({ received: true });
    }

    if (intent.metadata?.purpose === "WALLET_TOPUP") {
      await creditWallet({
        userId: intent.user,
        amount: intent.amount,
        reason: "PAYMENT_SUCCESS",
        reference: intent._id.toString(),
        metadata: { gateway: intent.gateway, gatewayPaymentId },
      });
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("PAYMENT WEBHOOK ERROR:", err);
    return res.json({ received: false });
  }
};

module.exports = { paymentSuccessWebhook, verifyRazorpayWebhook };
