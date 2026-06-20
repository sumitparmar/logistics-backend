const PaymentIntent = require("../models/PaymentIntent");
const { creditWallet } = require("./wallet.service");
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
  const intent = await PaymentIntent.findOneAndUpdate(
    {
      gatewayOrderId,
      status: "REFUND_REQUESTED",
    },
    {
      $set: {
        status: "REFUND_PROCESSING",
      },
      $push: {
        statusHistory: {
          status: "REFUND_PROCESSING",
        },
      },
    },
    {
      new: true,
    },
  );

  if (!intent) return null;

  await creditWallet({
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
