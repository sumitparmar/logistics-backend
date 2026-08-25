const crypto = require("crypto");
const ReviewInvitation = require("../models/ReviewInvitation");
const CustomerReview = require("../models/CustomerReview");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const frontendUrl = () => (process.env.FRONTEND_URL || "https://movekart.in").replace(/\/+$/, "");

const sendDeliveryFeedbackInvitation = async (order) => {
  if (await CustomerReview.exists({ order: order._id })) return null;

  const user = await User.findById(order.user).select("name email").lean();
  const email = user?.email?.trim().toLowerCase() || null;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  let invitation = await ReviewInvitation.findOne({ order: order._id }).select("+tokenHash");
  if (invitation?.status === "SUBMITTED" || invitation?.emailSentAt) return invitation;

  if (!invitation) {
    const token = crypto.randomBytes(32).toString("hex");
    try {
      invitation = await ReviewInvitation.create({
        order: order._id,
        user: order.user,
        email,
        tokenHash: hashToken(token),
        status: email ? "PENDING" : "EMAIL_UNAVAILABLE",
        expiresAt,
      });
    } catch (error) {
      if (error?.code === 11000) {
        invitation = await ReviewInvitation.findOne({ order: order._id }).select("+tokenHash");
      } else {
        throw error;
      }
    }
    if (!email || !invitation?.tokenHash || invitation.emailSentAt) return invitation;
  }

  const emailEnabled = String(process.env.REVIEW_EMAIL_ENABLED || "true").toLowerCase() !== "false";
  const emailConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  if (!email || !emailEnabled || !emailConfigured) {
    return ReviewInvitation.findByIdAndUpdate(invitation._id, {
      $set: { status: "EMAIL_UNAVAILABLE", email },
    }, { new: true });
  }

  const claim = await ReviewInvitation.findOneAndUpdate(
    { _id: invitation._id, emailSentAt: null, status: { $in: ["PENDING", "FAILED", "OPENED", "DISMISSED", "EMAIL_UNAVAILABLE"] } },
    { $set: { status: "SENDING", email, expiresAt }, $inc: { emailAttempts: 1 } },
    { new: true },
  ).select("+tokenHash");
  if (!claim) return ReviewInvitation.findById(invitation._id).select("+tokenHash");

  const orderRef = order.borzoOrderId || String(order._id).slice(-8).toUpperCase();
  // Generate the raw token only for this email; the database stores its hash.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenUpdated = await ReviewInvitation.findOneAndUpdate(
    { _id: claim._id, emailSentAt: null },
    { $set: { tokenHash: hashToken(rawToken) } },
    { new: true },
  ).select("+tokenHash");
  if (!tokenUpdated) return null;
  const feedbackLink = `${frontendUrl()}/feedback?token=${encodeURIComponent(rawToken)}`;
  const customerName = escapeHtml(user?.name || order.customer?.name || "Customer");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2>How was your MoveKart delivery?</h2><p>Hello ${customerName},</p><p>Your MoveKart order <strong>${escapeHtml(orderRef)}</strong> has been delivered.</p><p>We would value your feedback. It takes less than a minute and helps us improve every delivery.</p><p><a href="${escapeHtml(feedbackLink)}" style="display:inline-block;padding:12px 20px;background:#ff8a00;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Share feedback</a></p><p>This link is valid for 30 days. You can also skip this request and continue using MoveKart as usual.</p></body></html>`;
  const text = `Hello ${user?.name || order.customer?.name || "Customer"}, your MoveKart order ${orderRef} has been delivered. Share feedback: ${feedbackLink}. This link is valid for 30 days.`;

  try {
    await sendEmail(email, "How was your MoveKart delivery?", html, [], text);
    return ReviewInvitation.findOneAndUpdate(
      { _id: claim._id, emailSentAt: null },
      { $set: { status: "SENT", emailSentAt: new Date(), lastEmailError: null } },
      { new: true },
    );
  } catch (error) {
    await ReviewInvitation.findByIdAndUpdate(claim._id, { $set: { status: "FAILED", lastEmailError: String(error.message || "Email delivery failed").slice(0, 500) } });
    throw error;
  }
};

module.exports = { sendDeliveryFeedbackInvitation, hashToken };
