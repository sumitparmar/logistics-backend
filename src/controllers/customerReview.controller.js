const mongoose = require("mongoose");
const CustomerReview = require("../models/CustomerReview");
const Order = require("../models/Order");
const User = require("../models/User");
const ReviewInvitation = require("../models/ReviewInvitation");
const { hashToken } = require("../services/reviewInvitation.service");
const { createAdminNotification } = require("../services/adminNotification.service");

const safeLimit = (value, fallback = 6) =>
  Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), 12);

const publicReview = (review) => ({
  id: String(review._id),
  rating: review.rating,
  comment: review.comment,
  displayName: review.displayName,
  verifiedDelivery: Boolean(review.verifiedDelivery),
  createdAt: review.createdAt,
});

const listPublicReviews = async (req, res, next) => {
  try {
    const limit = safeLimit(req.query.limit);
    const [reviews, summary] = await Promise.all([
      CustomerReview.find({ status: "APPROVED" })
        .select("rating comment displayName verifiedDelivery createdAt")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      CustomerReview.aggregate([
        { $match: { status: "APPROVED" } },
        { $group: { _id: null, count: { $sum: 1 }, averageRating: { $avg: "$rating" } } },
      ]),
    ]);

    const aggregate = summary[0] || { count: 0, averageRating: 0 };
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json({
      success: true,
      data: {
        reviews: reviews.map(publicReview),
        summary: {
          count: aggregate.count,
          averageRating: Number((aggregate.averageRating || 0).toFixed(1)),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createCustomerReview = async (req, res, next) => {
  try {
    const { orderId, rating, comment, displayName } = req.body || {};
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: "A valid delivered order is required" });
    }

    const numericRating = Number(rating);
    const cleanComment = String(comment || "").trim();
    const cleanName = String(displayName || "").trim();
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }
    if (cleanComment.length < 10 || cleanComment.length > 500) {
      return res.status(400).json({ success: false, message: "Feedback must be between 10 and 500 characters" });
    }
    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({ success: false, message: "Display name must be between 2 and 80 characters" });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
      status: "DELIVERED",
    }).select("_id");
    if (!order) {
      return res.status(403).json({ success: false, message: "Feedback is available only for your delivered orders" });
    }

    const existing = await CustomerReview.findOne({ order: order._id }).select("status").lean();
    if (existing) {
      return res.status(409).json({ success: false, message: "Feedback has already been submitted for this order" });
    }

    const review = await CustomerReview.create({
      order: order._id,
      user: req.user._id,
      rating: numericRating,
      comment: cleanComment,
      displayName: cleanName,
      verifiedDelivery: true,
    });
    try {
      await createAdminNotification({
        type: "SYSTEM",
        title: "New customer feedback",
        message: `${cleanName} submitted feedback for a completed delivery.`,
        actionLabel: "Review feedback",
        actionUrl: "/admin/reviews",
        priority: "MEDIUM",
      });
    } catch (notificationError) {
      console.error("Customer review notification failed:", notificationError.message);
    }
    return res.status(201).json({
      success: true,
      message: "Thank you. Your feedback is awaiting review.",
      data: { id: review._id, status: review.status },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "Feedback has already been submitted for this order" });
    }
    return next(error);
  }
};

const getOrderReview = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    const review = await CustomerReview.findOne({ order: req.params.orderId, user: req.user._id })
      .select("rating comment displayName status createdAt")
      .lean();
    return res.json({ success: true, data: { hasReview: Boolean(review), review: review || null } });
  } catch (error) {
    return next(error);
  }
};

const validateReviewPayload = (body = {}) => {
  const numericRating = Number(body.rating);
  const cleanComment = String(body.comment || "").trim();
  const cleanName = String(body.displayName || "").trim();
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return { error: "Rating must be between 1 and 5" };
  }
  if (cleanComment.length < 10 || cleanComment.length > 500) {
    return { error: "Feedback must be between 10 and 500 characters" };
  }
  if (cleanName.length < 2 || cleanName.length > 80) {
    return { error: "Display name must be between 2 and 80 characters" };
  }
  return { numericRating, cleanComment, cleanName };
};

const notifyReviewSubmitted = async (displayName) => {
  try {
    await createAdminNotification({
      type: "SYSTEM",
      title: "New customer feedback",
      message: `${displayName} submitted feedback for a completed delivery.`,
      actionLabel: "Review feedback",
      actionUrl: "/admin/reviews",
      priority: "MEDIUM",
    });
  } catch (notificationError) {
    console.error("Customer review notification failed:", notificationError.message);
  }
};

const getReviewInvite = async (req, res, next) => {
  try {
    const token = String(req.params.token || "");
    if (token.length < 40 || token.length > 100) {
      return res.status(400).json({ success: false, message: "Invalid feedback link" });
    }
    const invitation = await ReviewInvitation.findOne({ tokenHash: hashToken(token) })
      .select("+tokenHash order user email status expiresAt")
      .lean();
    if (!invitation || invitation.expiresAt < new Date() || invitation.status === "SUBMITTED") {
      return res.status(410).json({ success: false, message: "This feedback link has expired or was already used" });
    }
    const order = await Order.findById(invitation.order).select("_id borzoOrderId status deliveredAt").lean();
    if (!order || order.status !== "DELIVERED") {
      return res.status(409).json({ success: false, message: "Feedback is available after delivery is completed" });
    }
    await ReviewInvitation.findByIdAndUpdate(invitation._id, {
      $set: { status: invitation.status === "DISMISSED" ? "DISMISSED" : "OPENED", openedAt: new Date() },
    });
    return res.json({
      success: true,
      data: {
        orderId: order._id,
        orderReference: order.borzoOrderId || String(order._id).slice(-8).toUpperCase(),
        deliveredAt: order.deliveredAt,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const submitReviewInvite = async (req, res, next) => {
  try {
    const token = String(req.params.token || "");
    const validation = validateReviewPayload(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });
    const invitation = await ReviewInvitation.findOne({ tokenHash: hashToken(token) }).select("+tokenHash");
    if (!invitation || invitation.expiresAt < new Date() || invitation.status === "SUBMITTED") {
      return res.status(410).json({ success: false, message: "This feedback link has expired or was already used" });
    }
    const order = await Order.findOne({ _id: invitation.order, user: invitation.user, status: "DELIVERED" }).select("_id");
    if (!order) return res.status(403).json({ success: false, message: "Feedback is available only for the completed delivery" });
    const existing = await CustomerReview.exists({ order: order._id });
    if (existing) return res.status(409).json({ success: false, message: "Feedback has already been submitted for this order" });

    const review = await CustomerReview.create({
      order: order._id,
      user: invitation.user,
      rating: validation.numericRating,
      comment: validation.cleanComment,
      displayName: validation.cleanName,
      verifiedDelivery: true,
    });
    await ReviewInvitation.findByIdAndUpdate(invitation._id, { $set: { status: "SUBMITTED", submittedAt: new Date() } });
    await notifyReviewSubmitted(validation.cleanName);
    return res.status(201).json({ success: true, message: "Thank you. Your feedback is awaiting review.", data: { id: review._id, status: review.status } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Feedback has already been submitted for this order" });
    return next(error);
  }
};

const dismissReviewPrompt = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: "Invalid order id" });
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id, status: "DELIVERED" }).select("_id");
    if (!order) return res.status(404).json({ success: false, message: "Delivered order not found" });
    await ReviewInvitation.findOneAndUpdate(
      { order: order._id, user: req.user._id, status: { $ne: "SUBMITTED" } },
      { $set: { promptDismissedAt: new Date(), status: "DISMISSED" } },
    );
    return res.json({ success: true, message: "Feedback prompt dismissed" });
  } catch (error) {
    return next(error);
  }
};

const listAdminReviews = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const query = {};
    if (["PENDING", "APPROVED", "REJECTED"].includes(req.query.status)) query.status = req.query.status;
    const search = String(req.query.search || "").trim();
    if (search.length >= 2) query.$or = [
      { displayName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { comment: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
    ];
    const [reviews, total] = await Promise.all([
      CustomerReview.find(query)
        .populate("user", "name email")
        .populate("order", "borzoOrderId status createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CustomerReview.countDocuments(query),
    ]);
    return res.json({ success: true, data: reviews, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return next(error);
  }
};

const moderateReview = async (req, res, next) => {
  try {
    const { status, moderationNote } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id) || !["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "A valid review and moderation status are required" });
    }
    const review = await CustomerReview.findByIdAndUpdate(
      req.params.id,
      { status, moderationNote: String(moderationNote || "").trim().slice(0, 300) || null, reviewedBy: req.user._id, reviewedAt: new Date() },
      { new: true, runValidators: true },
    ).lean();
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    return res.json({ success: true, message: `Review ${status.toLowerCase()}`, data: review });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPublicReviews,
  createCustomerReview,
  getOrderReview,
  getReviewInvite,
  submitReviewInvite,
  dismissReviewPrompt,
  listAdminReviews,
  moderateReview,
};
