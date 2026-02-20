const PaymentIntent = require("../models/PaymentIntent");

// CREATE
const createPaymentIntent = async ({
  userId,
  amount,
  currency = "INR",
  paymentMethod,
}) => {
  if (!amount || Number(amount) <= 0) {
    const err = new Error("Invalid amount");
    err.statusCode = 400;
    throw err;
  }

  const intent = await PaymentIntent.create({
    user: userId,
    amount: Number(amount),
    currency,
    paymentMethod,
    gateway: "RAZORPAY",
    status: "CREATED",
    statusHistory: [{ status: "CREATED" }],
  });

  return intent;
};

// MARK PROCESSING
const markProcessing = async (intentId) => {
  const intent = await PaymentIntent.findById(intentId);
  if (!intent) return null;

  if (intent.status !== "CREATED") return intent;

  intent.status = "PROCESSING";
  intent.statusHistory.push({ status: "PROCESSING" });
  await intent.save();

  return intent;
};

// MARK SUCCESS
const markSuccess = async ({ intentId, gatewayPaymentId, metadata }) => {
  const intent = await PaymentIntent.findById(intentId);
  if (!intent) return null;

  if (intent.status === "SUCCESS") return intent;

  intent.status = "SUCCESS";
  intent.gatewayPaymentId = gatewayPaymentId;
  intent.metadata = metadata;
  intent.statusHistory.push({ status: "SUCCESS" });

  await intent.save();
  return intent;
};

// MARK FAILED
const markFailed = async ({ intentId, metadata }) => {
  const intent = await PaymentIntent.findById(intentId);
  if (!intent) return null;

  intent.status = "FAILED";
  intent.metadata = metadata;
  intent.statusHistory.push({ status: "FAILED" });

  await intent.save();
  return intent;
};

module.exports = {
  createPaymentIntent,
  markProcessing,
  markSuccess,
  markFailed,
};
