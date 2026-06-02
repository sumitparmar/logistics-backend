const { sendSmsSafely } = require("./sms.service");

const buildTrackingLink = (order) => {
  const frontendUrl = (process.env.FRONTEND_URL || "https://movekart.in").replace(
    /\/+$/,
    "",
  );

  return `${frontendUrl}/app/track?orderId=${order._id}`;
};

const notifyOrderCreated = async (order) => {
  if (String(process.env.DELIVERY_SMS_ENABLED || "true") === "false") {
    return;
  }

  const trackingLink = buildTrackingLink(order);
  const orderRef = order.borzoOrderId || String(order._id).slice(-8);

  const message = `MoveKart order ${orderRef} is created. Track here: ${trackingLink}`;

  await Promise.all([
    sendSmsSafely(order.customer?.phone, message, {
      orderId: order._id,
      event: "ORDER_CREATED",
    }),
    ...((order.stops || [])
      .filter((stop) => stop.type === "DROP" && stop.phone)
      .map((stop) =>
        sendSmsSafely(stop.phone, message, {
          orderId: order._id,
          event: "ORDER_CREATED_RECIPIENT",
        }),
      )),
  ]);
};

const notifyOrderDelivered = async (order) => {
  if (String(process.env.DELIVERY_SMS_ENABLED || "true") === "false") {
    return;
  }

  const orderRef = order.borzoOrderId || String(order._id).slice(-8);
  const message = `MoveKart order ${orderRef} has been delivered. Thank you for using MoveKart.`;

  await sendSmsSafely(order.customer?.phone, message, {
    orderId: order._id,
    event: "ORDER_DELIVERED",
  });
};

module.exports = {
  notifyOrderCreated,
  notifyOrderDelivered,
};
