const paymentMethods = require("../constants/paymentMethods");
const { sendSuccess } = require("../utils/response");

const getPaymentMethods = async (req, res) => {
  return sendSuccess(res, paymentMethods, "Payment methods fetched");
};

module.exports = { getPaymentMethods };
