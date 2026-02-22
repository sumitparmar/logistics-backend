const {
  getOrderSummaryService,
  getDailyOrdersService,
  getProviderBreakdownService,
  getVehicleBreakdownService,
  getRevenueSummaryService,
} = require("../services/analytics.service");

const { sendSuccess } = require("../utils/response");

const getOrderSummary = async (req, res, next) => {
  try {
    const data = await getOrderSummaryService();
    return sendSuccess(res, data, "Order summary fetched");
  } catch (err) {
    next(err);
  }
};

// DAILY ORDERS TIME-SERIES

const getDailyOrders = async (req, res, next) => {
  try {
    const days = Number(req.query.days || 14);
    const data = await getDailyOrdersService(req.user._id, days);
    return sendSuccess(res, data, "Daily orders fetched");
  } catch (err) {
    next(err);
  }
};

const getRevenueSummary = async (req, res, next) => {
  try {
    const data = await getRevenueSummaryService();
    return sendSuccess(res, data, "Revenue summary fetched");
  } catch (err) {
    next(err);
  }
};

const getProviderBreakdown = async (req, res, next) => {
  try {
    const data = await getProviderBreakdownService();
    return sendSuccess(res, data, "Provider breakdown fetched");
  } catch (err) {
    next(err);
  }
};

const getVehicleBreakdown = async (req, res, next) => {
  try {
    const data = await getVehicleBreakdownService();
    return sendSuccess(res, data, "Vehicle breakdown fetched");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOrderSummary,
  getDailyOrders,
  getRevenueSummary,
  getProviderBreakdown,
  getVehicleBreakdown,
};
