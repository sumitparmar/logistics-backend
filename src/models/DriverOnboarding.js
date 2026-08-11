const mongoose = require("mongoose");

const driverOnboardingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"],
      default: "DRAFT",
      index: true,
    },
    personal: {
      fullName: { type: String, trim: true, required: true },
      phone: { type: String, trim: true, required: true },
      email: { type: String, lowercase: true, trim: true },
      city: { type: String, trim: true, required: true },
      address: { type: String, trim: true, required: true },
      dateOfBirth: Date,
    },
    vehicle: {
      vehicleTypeId: { type: Number, required: true },
      vehicleName: { type: String, trim: true },
      registrationNumber: { type: String, uppercase: true, trim: true },
      drivingLicenseNumber: { type: String, uppercase: true, trim: true },
    },
    documents: {
      aadhaarNumber: { type: String, trim: true },
      panNumber: { type: String, uppercase: true, trim: true },
      licenseUrl: { type: String, trim: true },
      rcUrl: { type: String, trim: true },
      aadhaarUrl: { type: String, trim: true },
      panUrl: { type: String, trim: true },
    },
    payout: {
      accountHolderName: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountNumberLast4: { type: String, trim: true },
      ifsc: { type: String, uppercase: true, trim: true },
    },
    servicePreferences: {
      preferredAreas: [{ type: String, trim: true }],
      availability: {
        type: String,
        enum: ["FULL_TIME", "PART_TIME", "WEEKENDS", "FLEXIBLE"],
        default: "FLEXIBLE",
      },
    },
    consent: {
      termsAccepted: { type: Boolean, default: false },
      backgroundCheckAccepted: { type: Boolean, default: false },
      acceptedAt: Date,
    },
    review: {
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: Date,
      remarks: { type: String, trim: true },
    },
    submittedAt: Date,
  },
  { timestamps: true },
);

driverOnboardingSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("DriverOnboarding", driverOnboardingSchema);
