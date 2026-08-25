const cron = require("node-cron");
const ReviewInvitation = require("../models/ReviewInvitation");
const Order = require("../models/Order");
const CustomerReview = require("../models/CustomerReview");
const { sendDeliveryFeedbackInvitation } = require("../services/reviewInvitation.service");
const { ensureDeliveredFeedbackPrompt } = require("../services/deliveryNotification.service");

const startReviewInvitationRecoveryJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const invitations = await ReviewInvitation.find({
        status: { $in: ["PENDING", "FAILED", "OPENED", "DISMISSED"] },
        email: { $ne: null },
        emailSentAt: null,
        $or: [
          { updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
          { lastEmailError: null },
        ],
      }).sort({ createdAt: 1 }).limit(100).lean();

      for (const invitation of invitations) {
        const order = await Order.findById(invitation.order);
        if (!order || order.status !== "DELIVERED") continue;
        if (await CustomerReview.exists({ order: order._id })) continue;
        await ensureDeliveredFeedbackPrompt(order);
        await sendDeliveryFeedbackInvitation(order);
      }

      const recentDeliveredOrders = await Order.find({
        status: "DELIVERED",
        deliveredAt: { $gte: cutoff },
      }).sort({ deliveredAt: -1 }).limit(100);
      for (const order of recentDeliveredOrders) {
        if (await CustomerReview.exists({ order: order._id })) continue;
        await ensureDeliveredFeedbackPrompt(order);
        await sendDeliveryFeedbackInvitation(order);
      }
    } catch (error) {
      console.error("REVIEW INVITATION RECOVERY JOB ERROR:", error.message);
    }
  });
};

module.exports = startReviewInvitationRecoveryJob;
