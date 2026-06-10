const { sendSmsSafely } = require("./sms.service");

const {
  createCustomerNotification,
} = require("./customerNotification.service");

const buildTrackingLink = (order) => {
  const frontendUrl = (
    process.env.FRONTEND_URL || "https://movekart.in"
  ).replace(/\/+$/, "");

  return `${frontendUrl}/app/track?orderId=${order._id}`;
};

const notifyOrderCreated = async (order) => {
  if (String(process.env.DELIVERY_SMS_ENABLED || "true") === "false") {
    return;
  }

  const trackingLink = buildTrackingLink(order);
  const orderRef = order.borzoOrderId || String(order._id).slice(-8);

  const message = `MoveKart order ${orderRef} is created. Track here: ${trackingLink}`;

  await createCustomerNotification({
    user: order.customer._id,
    order: order._id,
    type: "ORDER_CREATED",
    title: "Order Created",
    message: `Your order #${orderRef} has been created successfully.`,
  });

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
};

const notifyOrderDelivered = async (order) => {
  if (String(process.env.DELIVERY_SMS_ENABLED || "true") === "false") {
    return;
  }

  const orderRef = order.borzoOrderId || String(order._id).slice(-8);
  const message = `MoveKart order ${orderRef} has been delivered. Thank you for using MoveKart.`;

  await createCustomerNotification({
    user: order.customer._id,
    order: order._id,
    type: "ORDER_DELIVERED",
    title: "Order Delivered",
    message: `Your order #${orderRef} has been delivered successfully.`,
  });

  await sendSmsSafely(order.customer?.phone, message, {
    orderId: order._id,
    event: "ORDER_DELIVERED",
  });
};

module.exports = {
  notifyOrderCreated,
  notifyOrderDelivered,
};
