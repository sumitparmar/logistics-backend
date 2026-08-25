const express = require("express");
const protect = require("../middlewares/auth.middleware");
const { orderLimiter } = require("../middlewares/rateLimiter");
const { allowPermissions } = require("../middlewares/role.middleware");
const {
  listPublicReviews,
  createCustomerReview,
  getOrderReview,
  listAdminReviews,
  moderateReview,
  getReviewInvite,
  submitReviewInvite,
  dismissReviewPrompt,
} = require("../controllers/customerReview.controller");

const router = express.Router();

router.get("/public", listPublicReviews);
router.get("/invite/:token", getReviewInvite);
router.post("/invite/:token", orderLimiter, submitReviewInvite);
router.post("/", protect, orderLimiter, createCustomerReview);
router.post("/order/:orderId/dismiss", protect, dismissReviewPrompt);
router.get("/order/:orderId", protect, getOrderReview);

router.get("/admin", protect, allowPermissions("reviews.read"), listAdminReviews);
router.patch("/admin/:id/status", protect, allowPermissions("reviews.update"), moderateReview);

module.exports = router;
