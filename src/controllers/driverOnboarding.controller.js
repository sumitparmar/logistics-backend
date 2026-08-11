const { sendSuccess } = require("../utils/response");
const {
  getMyDriverOnboarding,
  getDriverOnboardingOptions,
  saveMyDriverOnboarding,
  listDriverOnboarding,
  updateDriverOnboardingStatus,
} = require("../services/driverOnboarding.service");

const getOptions = async (req, res, next) => {
  try {
    const options = await getDriverOnboardingOptions();
    return sendSuccess(res, options, "Driver onboarding options fetched");
  } catch (err) {
    next(err);
  }
};

const getMine = async (req, res, next) => {
  try {
    const application = await getMyDriverOnboarding(req.user._id);
    return sendSuccess(res, application, "Driver onboarding fetched");
  } catch (err) {
    next(err);
  }
};

const saveMine = async (req, res, next) => {
  try {
    const application = await saveMyDriverOnboarding({
      userId: req.user._id,
      payload: req.body,
      submit: false,
    });
    return sendSuccess(res, application, "Driver onboarding saved");
  } catch (err) {
    next(err);
  }
};

const submitMine = async (req, res, next) => {
  try {
    const application = await saveMyDriverOnboarding({
      userId: req.user._id,
      payload: req.body,
      submit: true,
    });
    return sendSuccess(res, application, "Driver onboarding submitted");
  } catch (err) {
    next(err);
  }
};

const listApplications = async (req, res, next) => {
  try {
    const result = await listDriverOnboarding(req.query);
    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;

    if (!["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status)) {
      const err = new Error("Invalid onboarding status");
      err.statusCode = 400;
      throw err;
    }

    const application = await updateDriverOnboardingStatus({
      id: req.params.id,
      status,
      remarks,
      adminId: req.user._id,
    });

    return sendSuccess(res, application, "Driver onboarding updated");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMine,
  getOptions,
  saveMine,
  submitMine,
  listApplications,
  updateApplicationStatus,
};
