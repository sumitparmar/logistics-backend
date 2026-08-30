const { sendSmsSafely } = require("./sms.service");

const {
  createCustomerNotification,
} = require("./customerNotification.service");
const { createAdminNotification } = require("./adminNotification.service");
const CustomerNotification = require("../models/CustomerNotification");
const { sendDeliveryFeedbackInvitation } = require("./reviewInvitation.service");
const { getOrderReference } = require("../utils/orderReference");

const buildTrackingLink = (order) => {
  const frontendUrl = (
    process.env.FRONTEND_URL || "https://movekart.in"
  ).replace(/\/+$/, "");

  return `${frontendUrl}/app/track?orderId=${order._id}`;
};

const ensureDeliveredFeedbackPrompt = async (order) => {
  const userId = order.user || order.customer?._id;
  if (!userId) return null;

  const existing = await CustomerNotification.exists({
    user: userId,
    order: order._id,
    type: "ORDER_DELIVERED",
  });
  if (existing) return null;

  const orderRef = getOrderReference(order.borzoOrderId || order._id);
  return createCustomerNotification({
    user: userId,
    order: order._id,
    type: "ORDER_DELIVERED",
    title: "Order Delivered",
    message: `Your order #${orderRef} has been delivered. Share your delivery feedback when you are ready.`,
    actionLabel: "Share feedback",
    actionUrl: `/app/orders/${order._id}?feedback=1`,
    meta: { feedbackPrompt: true },
  });
};

const notifyOrderCreated = async (order) => {
  const trackingLink = buildTrackingLink(order);
  const orderRef = getOrderReference(order.borzoOrderId || order._id);

  const message = `MoveKart order ${orderRef} is created. Track here: ${trackingLink}`;

  await createCustomerNotification({
    user: order.user || order.customer?._id,
    order: order._id,
    type: "ORDER_CREATED",
    title: "Order Created",
    message: `Your order #${orderRef} has been created successfully.`,
  });

  createAdminNotification({
    type: "ORDER",
    title: "New order created",
    message: `Order #${orderRef} was created successfully.`,
    priority: "MEDIUM",
    meta: { orderId: order._id, userId: order.user || null },
  }).catch((notificationError) => {
    console.error("Order creation admin notification failed:", notificationError.message);
  });

  if (String(process.env.DELIVERY_SMS_ENABLED || "true") !== "false") {
    await Promise.all([
      sendSmsSafely(order.customer?.phone, message, {
        orderId: order._id,
        event: "ORDER_CREATED",
      }),
      ...(order.stops || [])
        .filter((stop) => stop.type === "DROP" && stop.phone)
        .map((stop) =>
          sendSmsSafely(stop.phone, message, {
            orderId: order._id,
            event: "ORDER_CREATED_RECIPIENT",
          }),
        ),
    ]);
  }
};

const notifyOrderDelivered = async (order) => {
  const orderRef = getOrderReference(order.borzoOrderId || order._id);
  const message = `MoveKart order ${orderRef} has been delivered. Thank you for using MoveKart.`;
  await ensureDeliveredFeedbackPrompt(order);

  sendDeliveryFeedbackInvitation(order).catch((error) => {
    console.error("DELIVERY FEEDBACK EMAIL ERROR:", error.message);
  });

  if (String(process.env.DELIVERY_SMS_ENABLED || "true") !== "false") {
    await sendSmsSafely(order.customer?.phone, message, {
      orderId: order._id,
      event: "ORDER_DELIVERED",
    });
  }
};

module.exports = {
  notifyOrderCreated,
  notifyOrderDelivered,
  ensureDeliveredFeedbackPrompt,
};
