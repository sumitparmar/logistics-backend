const razorpay = require("../providers/razorpay.provider");

const createGatewayOrder = async ({ amount, currency }) => {
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("Invalid payment amount");
  }
  if (
    process.env.PAYMENT_GATEWAY_MODE === "MOCK" ||
    (process.env.NODE_ENV !== "production" && !razorpay)
  ) {
    return {
      id: `mock_order_${Date.now()}`,
      amount: Math.round(Number(amount) * 100),
      currency,
    };
  }

  if (!razorpay) {
    throw new Error("Payment gateway not configured");
  }

  return razorpay.orders.create({
    amount: Math.round(Number(amount) * 100),
    currency,
  });
};

module.exports = {
  createGatewayOrder,
};
