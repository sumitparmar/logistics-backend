const { getDashboardSummaryService } = require("../services/dashboard.service");
const { sendSuccess } = require("../utils/response");

const getDashboardSummary = async (req, res, next) => {
  try {
    const data = await getDashboardSummaryService(req.user._id);
    return sendSuccess(res, data, "Dashboard summary fetched");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardSummary,
};
