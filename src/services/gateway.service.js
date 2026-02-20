const razorpay = require("../providers/razorpay.provider");

const createGatewayOrder = async ({ amount, currency }) => {
  if (process.env.PAYMENT_GATEWAY_MODE === "MOCK") {
    return {
      id: `mock_order_${Date.now()}`,
      amount: Number(amount) * 100,
      currency,
    };
  }

  if (!razorpay) {
    throw new Error("Payment gateway not configured");
  }

  return razorpay.orders.create({
    amount: Number(amount) * 100,
    currency,
  });
};

module.exports = {
  createGatewayOrder,
};
