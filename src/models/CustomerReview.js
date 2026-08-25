const mongoose = require("mongoose");

const customerReviewSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    moderationNote: { type: String, trim: true, maxlength: 300, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    verifiedDelivery: { type: Boolean, default: true },
  },
  { timestamps: true },
);

customerReviewSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("CustomerReview", customerReviewSchema);
