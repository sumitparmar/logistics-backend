const DriverOnboarding = require("../models/DriverOnboarding");
const { getVehicleTypes } = require("./providerCatalog.service");
const { getIO } = require("../config/socket");

const emitDriverOnboardingUpdate = (application) => {
  try {
    getIO().to("admin").emit("admin-driver-onboarding-update", application);
  } catch (err) {
    console.error("Socket emit failed:", err.message);
  }
};

const sanitizePayload = async (payload) => {
  const vehicleTypeId = Number(payload?.vehicle?.vehicleTypeId);
  const vehicles = await getVehicleTypes();
  const vehicle = vehicles.find((item) => Number(item.id) === vehicleTypeId);

  if (!vehicle) {
    const err = new Error("Invalid vehicle type");
    err.statusCode = 400;
    throw err;
  }

  return {
    personal: payload.personal,
    vehicle: {
      ...payload.vehicle,
      vehicleTypeId,
      vehicleName: vehicle.name || payload.vehicle?.vehicleName || "",
    },
    documents: payload.documents || {},
    payout: payload.payout || {},
    servicePreferences: payload.servicePreferences || {},
    consent: payload.consent || {},
  };
};

const getMyDriverOnboarding = async (userId) => {
  return DriverOnboarding.findOne({ user: userId });
};

const saveMyDriverOnboarding = async ({ userId, payload, submit = false }) => {
  const data = await sanitizePayload(payload);
  const existing = await DriverOnboarding.findOne({ user: userId });

  if (existing && ["UNDER_REVIEW", "APPROVED"].includes(existing.status)) {
    const err = new Error("Application is already under review");
    err.statusCode = 409;
    throw err;
  }

  if (submit) {
    if (!data.consent?.termsAccepted || !data.consent?.backgroundCheckAccepted) {
      const err = new Error("Required consent is missing");
      err.statusCode = 400;
      throw err;
    }

    data.status = "SUBMITTED";
    data.submittedAt = new Date();
    data.consent.acceptedAt = data.consent.acceptedAt || new Date();
  }

  const application = await DriverOnboarding.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        ...data,
        user: userId,
        status: submit ? "SUBMITTED" : existing?.status || "DRAFT",
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  emitDriverOnboardingUpdate(application);
  return application;
};

const listDriverOnboarding = async (query = {}) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 100);
  const skip = (page - 1) * limit;
  const filter = {};

  if (query.status && query.status !== "ALL") {
    filter.status = query.status;
  }

  if (query.search) {
    const regex = new RegExp(query.search, "i");
    filter.$or = [
      { "personal.fullName": regex },
      { "personal.phone": regex },
      { "personal.city": regex },
      { "vehicle.registrationNumber": regex },
    ];
  }

  const [data, total] = await Promise.all([
    DriverOnboarding.find(filter)
      .populate("user", "name email phone role")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DriverOnboarding.countDocuments(filter),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateDriverOnboardingStatus = async ({ id, status, remarks, adminId }) => {
  const application = await DriverOnboarding.findByIdAndUpdate(
    id,
    {
      $set: {
        status,
        review: {
          reviewedBy: adminId,
          reviewedAt: new Date(),
          remarks: remarks || "",
        },
      },
    },
    { new: true, runValidators: true },
  );

  if (!application) {
    const err = new Error("Driver onboarding application not found");
    err.statusCode = 404;
    throw err;
  }

  emitDriverOnboardingUpdate(application);
  return application;
};

module.exports = {
  getMyDriverOnboarding,
  saveMyDriverOnboarding,
  listDriverOnboarding,
  updateDriverOnboardingStatus,
};
