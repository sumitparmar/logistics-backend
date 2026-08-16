const razorpay = require("../providers/razorpay.provider");

const createGatewayOrder = async ({ amount, currency }) => {
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("Invalid payment amount");
  }
  const mockGatewayEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.PAYMENT_GATEWAY_MODE === "MOCK";

  if (mockGatewayEnabled) {
    return {
      id: `mock_order_${Date.now()}`,
      amount: Math.round(Number(amount) * 100),
      currency,
    };
  }

  if (!razorpay) {
    throw new Error("Online payment is not configured");
  }

  return razorpay.orders.create({
    amount: Math.round(Number(amount) * 100),
    currency,
  });
};

module.exports = {
  createGatewayOrder,
};
