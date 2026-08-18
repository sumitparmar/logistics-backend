const DriverOnboarding = require("../models/DriverOnboarding");
const PublicDriverOnboarding = require("../models/PublicDriverOnboarding");
const SystemSettings = require("../models/SystemSettings");
const { getVehicleTypes } = require("./providerCatalog.service");
const { getIO } = require("../config/socket");

const DEFAULT_DRIVER_ONBOARDING = {
  serviceAreaCountry: "in",
  requireGooglePlaceSelection: false,
  availabilityOptions: [
    { value: "FLEXIBLE", label: "Flexible" },
    { value: "FULL_TIME", label: "Full time" },
    { value: "PART_TIME", label: "Part time" },
    { value: "WEEKENDS", label: "Weekends" },
  ],
  requiredConsents: [
    {
      key: "termsAccepted",
      label: "I confirm that the information provided is accurate.",
    },
    {
      key: "backgroundCheckAccepted",
      label:
        "I consent to document and background verification for onboarding.",
    },
  ],
};

const emitDriverOnboardingUpdate = (application) => {
  try {
    getIO().to("admin").emit("admin-driver-onboarding-update", application);
  } catch (err) {
    console.error("Socket emit failed:", err.message);
  }
};

const sanitizePayload = async (payload) => {
  if (!/^\d{10}$/.test(String(payload?.personal?.phone || '').trim())) {
    const err = new Error("Phone number must contain exactly 10 digits");
    err.statusCode = 400;
    throw err;
  }

  const vehicleTypeId = Number(payload?.vehicle?.vehicleTypeId);
  const vehicles = await getVehicleTypes();
  const vehicle = vehicles.find((item) => Number(item.id) === vehicleTypeId);

  if (!vehicle) {
    const err = new Error("Invalid vehicle type");
    err.statusCode = 400;
    throw err;
  }

  const settings = await getDriverOnboardingSettings();
  const preferredAreas = normalizePreferredAreas(
    payload?.servicePreferences?.preferredAreas || [],
    settings,
  );

  return {
    personal: payload.personal,
    vehicle: {
      ...payload.vehicle,
      vehicleTypeId,
      vehicleName: vehicle.name || payload.vehicle?.vehicleName || "",
    },
    documents: payload.documents || {},
    payout: payload.payout || {},
    servicePreferences: {
      ...(payload.servicePreferences || {}),
      preferredAreas,
    },
    consent: payload.consent || {},
  };
};

const getDriverOnboardingSettings = async () => {
  let settings = await SystemSettings.findOne();

  if (!settings) {
    settings = await SystemSettings.create({
      driverOnboarding: DEFAULT_DRIVER_ONBOARDING,
    });
  }

  const current = settings.driverOnboarding || {};
  const needsSeed =
    !current.availabilityOptions?.length || !current.requiredConsents?.length;

  if (needsSeed) {
    settings.driverOnboarding = {
      ...DEFAULT_DRIVER_ONBOARDING,
      ...(current.toObject ? current.toObject() : current),
      availabilityOptions: current.availabilityOptions?.length
        ? current.availabilityOptions
        : DEFAULT_DRIVER_ONBOARDING.availabilityOptions,
      requiredConsents: current.requiredConsents?.length
        ? current.requiredConsents
        : DEFAULT_DRIVER_ONBOARDING.requiredConsents,
    };
    await settings.save();
  }

  return settings.driverOnboarding || DEFAULT_DRIVER_ONBOARDING;
};

const normalizePreferredAreas = (areas, settings) => {
  return (Array.isArray(areas) ? areas : [])
    .map((area) => {
      if (typeof area === "string") {
        return {
          address: area.trim(),
          source: "MANUAL",
        };
      }

      return {
        address: String(area?.address || "").trim(),
        placeId: area?.placeId || null,
        city: area?.city || null,
        lat:
          area?.lat !== undefined && area?.lat !== null
            ? Number(area.lat)
            : null,
        lng:
          area?.lng !== undefined && area?.lng !== null
            ? Number(area.lng)
            : null,
        source: area?.placeId ? "GOOGLE_PLACES" : "MANUAL",
      };
    })
    .filter((area) => {
      if (!area.address) return false;
      if (settings.requireGooglePlaceSelection && !area.placeId) return false;
      return true;
    });
};

const getMyDriverOnboarding = async (userId) => {
  return DriverOnboarding.findOne({ user: userId });
};

const getDriverOnboardingOptions = async () => {
  const vehicles = await getVehicleTypes();
  const settings = await getDriverOnboardingSettings();

  return {
    vehicles,
    availabilityOptions: settings.availabilityOptions,
    requiredConsents: settings.requiredConsents,
    serviceAreaCountry: settings.serviceAreaCountry || "in",
    requireGooglePlaceSelection: Boolean(settings.requireGooglePlaceSelection),
  };
};

const submitPublicDriverOnboarding = async (payload) => {
  const data = await sanitizePayload(payload);

  if (!data.personal?.email) {
    const err = new Error("Email is required for a public application");
    err.statusCode = 400;
    throw err;
  }

  if (!data.consent?.termsAccepted || !data.consent?.backgroundCheckAccepted) {
    const err = new Error("Required consent is missing");
    err.statusCode = 400;
    throw err;
  }

  data.status = "SUBMITTED";
  data.submittedAt = new Date();
  data.consent.acceptedAt = new Date();

  const application = await PublicDriverOnboarding.create(data);
  emitDriverOnboardingUpdate({
    ...application.toObject(),
    source: "PUBLIC",
  });
  return application;
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

  const publicFilter = { ...filter };
  const fetchLimit = skip + limit;

  const [data, publicData, total, publicTotal] = await Promise.all([
    DriverOnboarding.find(filter)
      .populate("user", "name email phone role")
      .sort({ updatedAt: -1 })
      .limit(fetchLimit)
      .lean(),
    PublicDriverOnboarding.find(publicFilter)
      .sort({ updatedAt: -1 })
      .limit(fetchLimit)
      .lean(),
    DriverOnboarding.countDocuments(filter),
    PublicDriverOnboarding.countDocuments(publicFilter),
  ]);

  const combined = [
    ...data,
    ...publicData.map((application) => ({
      ...application,
      user: null,
      source: "PUBLIC",
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(skip, skip + limit);

  return {
    data: combined,
    pagination: {
      page,
      limit,
      total: total + publicTotal,
      totalPages: Math.ceil((total + publicTotal) / limit),
    },
  };
};

const updateDriverOnboardingStatus = async ({
  id,
  status,
  remarks,
  adminId,
  source = "AUTHENTICATED",
}) => {
  const Model = source === "PUBLIC" ? PublicDriverOnboarding : DriverOnboarding;
  const application = await Model.findByIdAndUpdate(
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
  getDriverOnboardingOptions,
  submitPublicDriverOnboarding,
  saveMyDriverOnboarding,
  listDriverOnboarding,
  updateDriverOnboardingStatus,
};
