const PaymentIntent = require("../models/PaymentIntent");
const { debitWallet } = require("./wallet.service");

const requestRefund = async ({ intentId, reason }) => {
  const intent = await PaymentIntent.findById(intentId);

  if (!intent) {
    throw new Error("Payment intent not found");
  }

  if (intent.status !== "SUCCESS") {
    throw new Error("Only successful payments can be refunded");
  }

  intent.status = "REFUND_REQUESTED";
  intent.statusHistory.push({ status: "REFUND_REQUESTED" });
  intent.metadata = { ...intent.metadata, refundReason: reason };

  await intent.save();

  return intent;
};

const completeRefund = async ({ gatewayOrderId }) => {
  const intent = await PaymentIntent.findOne({
    gatewayOrderId,
    status: { $in: ["REFUND_REQUESTED", "REFUND_PROCESSING"] },
  });

  if (!intent) return null;

  // Mark processing
  intent.status = "REFUND_PROCESSING";
  intent.statusHistory.push({ status: "REFUND_PROCESSING" });
  await intent.save();

  // Debit wallet (only once)
  await debitWallet({
    userId: intent.user,
    amount: intent.amount,
    reason: "PAYMENT_REFUND",
    reference: intent._id.toString(),
    metadata: { gateway: intent.gateway },
  });

  // Mark refunded
  intent.status = "REFUNDED";
  intent.refundedAt = new Date(); // add here

  intent.statusHistory.push({ status: "REFUNDED" });
  await intent.save();

  return intent;
};

module.exports = {
  requestRefund,
  completeRefund,
};
