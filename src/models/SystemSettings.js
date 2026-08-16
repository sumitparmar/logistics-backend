const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    platformName: {
      type: String,
      default: "MoveKart Logistics",
      trim: true,
    },

    supportEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    supportPhone: {
      type: String,
      default: "",
      trim: true,
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata",
      trim: true,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },

    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    allowRegistrations: {
      type: Boolean,
      default: true,
    },

    newOrderAlerts: {
      type: Boolean,
      default: true,
    },

    supportAlerts: {
      type: Boolean,
      default: true,
    },

    invoice: {
      legalName: { type: String, default: "", trim: true },
      registeredAddress: { type: String, default: "", trim: true },
      state: { type: String, default: "", trim: true },
      stateCode: { type: String, default: "", trim: true },
      gstin: { type: String, default: "", trim: true, uppercase: true },
      pan: { type: String, default: "", trim: true, uppercase: true },
      sacCode: { type: String, default: "", trim: true },
      prefix: { type: String, default: "MK", trim: true, uppercase: true },
      financialYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },
      templateVersion: { type: String, default: "1.0", trim: true },
      supportEmail: { type: String, default: "", trim: true, lowercase: true },
      supportPhone: { type: String, default: "", trim: true },
    },

    sessionTimeoutMinutes: {
      type: Number,
      default: 60,
      min: 5,
      max: 1440,
    },

    driverOnboarding: {
      serviceAreaCountry: {
        type: String,
        default: "in",
        trim: true,
        lowercase: true,
      },
      requireGooglePlaceSelection: {
        type: Boolean,
        default: false,
      },
      availabilityOptions: [
        {
          value: {
            type: String,
            enum: ["FULL_TIME", "PART_TIME", "WEEKENDS", "FLEXIBLE"],
            required: true,
          },
          label: { type: String, trim: true, required: true },
        },
      ],
      requiredConsents: [
        {
          key: {
            type: String,
            enum: ["termsAccepted", "backgroundCheckAccepted"],
            required: true,
          },
          label: { type: String, trim: true, required: true },
        },
      ],
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
