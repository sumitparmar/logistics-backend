const Order = require("../models/Order");
const { mapBorzoStatus } = require("../utils/statusMapper");
const mapDeliveryStatus = require("../utils/deliveryStatusMapper");
const { transitionStatus } = require("../engines/status.engine");
const { mapCourierFromBorzo } = require("../mappers/borzoCourier.mapper");
const verifyBorzoSignature = require("../utils/verifyBorzoSignature");
const WebhookEvent = require("../models/WebhookEvent");
const webhookFingerprint = require("../utils/webhookFingerprint");
const { creditWallet } = require("../services/wallet.service");
const { emitOrderUpdate } = require("../services/realtime.service");
const borzoWebhook = async (req, res) => {
  try {
    // Verify signature
    if (!verifyBorzoSignature(req)) {
      return res.status(401).json({ received: false });
    }

    const payload = req.body;
    if (!payload?.order?.order_id) {
      return res.status(200).json({ received: true });
    }
    // Idempotency (prevent duplicates)
    const fingerprint = webhookFingerprint({
      type: "order",
      order_id: payload?.order?.order_id,
      status: payload?.order?.status,
    });

    try {
      await WebhookEvent.create({ fingerprint });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({ received: true });
      }
      throw err;
    }

    //  Extract order info
    const borzoOrderId = payload?.order?.order_id;

    const deliveryStatus =
      payload?.order?.points?.find((point) => point?.delivery?.status)
        ?.delivery?.status || null;
    const borzoStatus = deliveryStatus || payload?.order?.status;

    if (!borzoOrderId || !borzoStatus) {
      return res.status(200).json({ received: true });
    }

    //  Find local order
    const order = await Order.findOne({
      borzoOrderId: String(borzoOrderId),
    });

    if (!order) {
      return res.status(200).json({ received: true });
    }

    //  Map + transition status
    const mappedStatus = deliveryStatus
      ? mapDeliveryStatus(deliveryStatus)
      : mapBorzoStatus(borzoStatus);
    if (!mappedStatus) {
      return res.status(200).json({ received: true });
    }

    order.status = transitionStatus(order.status, mappedStatus);

    if (
      order.statusHistory.length === 0 ||
      order.statusHistory[order.statusHistory.length - 1].status !==
        mappedStatus
    ) {
      order.statusHistory.push({ status: mappedStatus });
    }

    //  Courier info (optional)
    if (payload.order?.courier) {
      order.courier = mapCourierFromBorzo(payload.order.courier);
    }

    //  Save raw provider response
    order.rawProviderResponse = payload;

    const savedOrder = await order.save();

    emitOrderUpdate(savedOrder.user, savedOrder, { admin: true });

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("BORZO ORDER WEBHOOK ERROR:", error);
    return res.status(200).json({ received: true });
  }
};

const borzoDeliveryWebhook = async (req, res) => {
  try {
    // Verify signature
    if (!verifyBorzoSignature(req)) {
      return res.status(401).json({ received: false });
    }

    const payload = req.body;
    if (!payload?.delivery?.delivery_id) {
      return res.status(200).json({ received: true });
    }

    // Idempotency (prevent duplicates)
    const fingerprint = webhookFingerprint({
      type: "delivery",
      order_id: payload?.delivery?.order_id,
      delivery_id: payload?.delivery?.delivery_id,
      status: payload?.delivery?.status,
    });

    try {
      await WebhookEvent.create({ fingerprint });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({ received: true });
      }
      throw err;
    }

    const delivery = payload?.delivery;

    if (!delivery?.order_id || !delivery?.status) {
      return res.status(200).json({ received: true });
    }

    //  Find order
    const order = await Order.findOne({
      borzoOrderId: String(delivery.order_id),
    });

    if (!order) {
      return res.status(200).json({ received: true });
    }

    //  Map delivery status → internal status
    const mappedStatus = mapDeliveryStatus(delivery.status);
    if (!mappedStatus) {
      return res.status(200).json({ received: true });
    }
    order.status = transitionStatus(order.status, mappedStatus);

    // COD Settlement on Delivered
    if (
      mappedStatus === "DELIVERED" &&
      order.cod?.enabled === true &&
      order.codSettled !== true
    ) {
      await creditWallet({
        userId: order.user,
        amount: order.cod.amount,
        reason: "COD_ORDER_DELIVERED",
        reference: order._id.toString(),
        metadata: {
          borzoOrderId: order.borzoOrderId,
        },
      });

      order.codSettled = true;
    }

    if (
      order.statusHistory.length === 0 ||
      order.statusHistory[order.statusHistory.length - 1].status !==
        mappedStatus
    ) {
      order.statusHistory.push({ status: mappedStatus });
    }

    //  Store delivery block
    order.delivery = {
      deliveryId: delivery.delivery_id,
      status: delivery.status,
      statusDescription: delivery.status_description,
      statusDatetime: new Date(delivery.status_datetime),
      trackingUrl: delivery.tracking_url || null,
    };

    const savedOrder = await order.save();

    emitOrderUpdate(savedOrder.user, savedOrder, { admin: true });

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("BORZO DELIVERY WEBHOOK ERROR:", error);
    return res.status(200).json({ received: true });
  }
};

module.exports = {
  borzoWebhook,
  borzoDeliveryWebhook,
};
