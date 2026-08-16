const mongoose = require("mongoose");

const idempotencyRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    operation: {
      type: String,
      required: true,
      enum: ["CREATE_ORDER"],
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCEEDED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

idempotencyRecordSchema.index(
  { user: 1, operation: 1, key: 1 },
  { unique: true },
);
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("IdempotencyRecord", idempotencyRecordSchema);
