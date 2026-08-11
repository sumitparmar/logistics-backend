const PaymentIntent = require("../models/PaymentIntent");

// CREATE
const createPaymentIntent = async ({
  userId,
  amount,
  currency = "INR",
  paymentMethod,
}) => {
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    const err = new Error("Invalid amount");
    err.statusCode = 400;
    throw err;
  }

  const intent = await PaymentIntent.create({
    user: userId,
    amount: Number(Number(amount).toFixed(2)),
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
  return PaymentIntent.findOneAndUpdate(
    {
      _id: intentId,
      status: "CREATED",
    },
    {
      $set: { status: "PROCESSING" },
      $push: { statusHistory: { status: "PROCESSING" } },
    },
    { new: true },
  );
};

// MARK SUCCESS

const markSuccess = async ({ intentId, gatewayPaymentId, metadata }) => {
  const intent = await PaymentIntent.findOneAndUpdate(
    {
      _id: intentId,
      status: "PROCESSING",
    },
    {
      $set: {
        status: "SUCCESS",
        gatewayPaymentId,
        metadata,
      },
      $push: {
        statusHistory: { status: "SUCCESS" },
      },
    },
    { new: true },
  );

  if (!intent) {
    return null; // already processed or invalid state
  }

  return intent;
};

// MARK FAILED

const markFailed = async ({ intentId, metadata }) => {
  return PaymentIntent.findOneAndUpdate(
    {
      _id: intentId,
      status: { $in: ["CREATED", "PROCESSING"] },
    },
    {
      $set: {
        status: "FAILED",
        metadata,
      },
      $push: {
        statusHistory: { status: "FAILED" },
      },
    },
    { new: true },
  );
};

const getSuccessfulIntentForUser = async ({ intentId, userId, amount }) => {
  if (!intentId) {
    const err = new Error("Payment intent is required for advance checkout");
    err.statusCode = 402;
    throw err;
  }

  const intent = await PaymentIntent.findOne({
    _id: intentId,
    user: userId,
    status: "SUCCESS",
  });

  if (!intent) {
    const err = new Error("Advance payment is not completed");
    err.statusCode = 402;
    throw err;
  }

  const expectedAmount = Number(Number(amount || 0).toFixed(2));
  if (expectedAmount > 0 && Number(intent.amount) !== expectedAmount) {
    const err = new Error("Payment amount does not match order amount");
    err.statusCode = 409;
    throw err;
  }

  return intent;
};

const attachOrderToIntent = async ({ intentId, orderId }) => {
  return PaymentIntent.findByIdAndUpdate(
    intentId,
    {
      $set: {
        order: orderId,
      },
    },
    { new: true },
  );
};

module.exports = {
  createPaymentIntent,
  markProcessing,
  markSuccess,
  markFailed,
  getSuccessfulIntentForUser,
  attachOrderToIntent,
};
