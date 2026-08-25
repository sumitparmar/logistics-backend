const mongoose = require("mongoose");

const reviewInvitationSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: null },
    tokenHash: { type: String, select: false, default: null },
    status: {
      type: String,
      enum: ["PENDING", "SENDING", "SENT", "OPENED", "DISMISSED", "SUBMITTED", "FAILED", "EMAIL_UNAVAILABLE"],
      default: "PENDING",
      index: true,
    },
    emailSentAt: { type: Date, default: null },
    emailAttempts: { type: Number, default: 0 },
    lastEmailError: { type: String, maxlength: 500, default: null },
    openedAt: { type: Date, default: null },
    promptDismissedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ReviewInvitation", reviewInvitationSchema);
