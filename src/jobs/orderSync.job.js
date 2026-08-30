const cron = require("node-cron");
const Order = require("../models/Order");
const pulseService = require("../services/pulse.service");
const { transitionStatus } = require("../engines/status.engine");
const { mapBorzoStatus } = require("../utils/statusMapper");
const mapDeliveryStatus = require("../utils/deliveryStatusMapper");
const { creditWallet } = require("../services/wallet.service");
const { processDeliveredOrder } = require("../services/invoice.service");
const {
  notifyOrderDelivered,
} = require("../services/deliveryNotification.service");
const { mapCourierFromBorzo } = require("../mappers/borzoCourier.mapper");
const { emitOrderUpdate } = require("../services/realtime.service");
const startOrderSyncJob = () => {
  cron.schedule("*/2 * * * *", async () => {
    try {
      const orders = await Order.find({
        status: { $nin: ["DELIVERED", "CANCELLED", "FAILED"] },
      }).limit(50);

      for (const order of orders) {
        try {
          const attemptAt = new Date();
          const response = await pulseService.getOrder(order.borzoOrderId);

          if (
            !response?.is_successful ||
            !response.orders ||
            response.orders.length === 0
          ) {
            await Order.updateOne(
              { _id: order._id },
              {
                $set: {
                  "providerSync.lastAttemptAt": attemptAt,
                  "providerSync.lastError": "Provider returned no order data",
                },
                $inc: { "providerSync.consecutiveFailures": 1 },
              },
            );
            continue;
          }

        const borzoOrder = response.orders[0];

        const deliveryStatus =
          borzoOrder.points?.find((p) => p.delivery)?.delivery?.status || null;

        const mappedStatus = deliveryStatus
          ? mapDeliveryStatus(deliveryStatus)
          : mapBorzoStatus(borzoOrder.status);

        const nextStatus = transitionStatus(order.status, mappedStatus);
        const mappedCourier = mapCourierFromBorzo(borzoOrder.courier);
        const courierChanged =
          mappedCourier &&
          JSON.stringify(order.courier || null) !==
            JSON.stringify(mappedCourier);

        if (nextStatus !== order.status || courierChanged) {
          order.status = nextStatus;
          order.rawProviderResponse = response;

          if (mappedCourier) {
            order.courier = mappedCourier;
          }

          if (
            order.statusHistory.length === 0 ||
            order.statusHistory[order.statusHistory.length - 1].status !==
              nextStatus
          ) {
            order.statusHistory.push({ status: nextStatus });
          }

          if (
            nextStatus === "DELIVERED" &&
            order.cod?.enabled === true &&
            Number(order.cod?.amount || 0) > 0 &&
            order.codSettled !== true
          ) {
            await creditWallet({
              userId: order.user,
              amount: order.cod.amount,
              reason: "COD_SETTLEMENT",
              reference: order.borzoOrderId,
              metadata: {
                provider: order.provider,
                borzoOrderId: order.borzoOrderId,
              },
            });

            order.codSettled = true;
          }

          const savedOrder = await order.save();

          // A successful provider response resets the operational retry
          // counter. The lifecycle status above is changed only from an
          // explicit Borzo status and never from a communication failure.
          await Order.updateOne(
            { _id: savedOrder._id },
            {
              $set: {
                "providerSync.lastAttemptAt": attemptAt,
                "providerSync.lastSuccessAt": new Date(),
                "providerSync.consecutiveFailures": 0,
              },
              $unset: { "providerSync.lastError": 1 },
            },
          );

          if (nextStatus === "DELIVERED") {
            try {
              await processDeliveredOrder(savedOrder);
              await notifyOrderDelivered(savedOrder);
            } catch (err) {
              console.error("DELIVERED ORDER PROCESSING ERROR:", err.message);
            }
          }

          emitOrderUpdate(savedOrder.user, savedOrder, { admin: true });
        } else {
          await Order.updateOne(
            { _id: order._id },
            {
              $set: {
                "providerSync.lastAttemptAt": attemptAt,
                "providerSync.lastSuccessAt": new Date(),
                "providerSync.consecutiveFailures": 0,
              },
              $unset: { "providerSync.lastError": 1 },
            },
          );
        }
        } catch (orderError) {
          // A timeout, transient Borzo error or empty response must leave the
          // local order in its current state for the next reconciliation pass.
          await Order.updateOne(
            { _id: order._id },
            {
              $set: {
                "providerSync.lastAttemptAt": new Date(),
                "providerSync.lastError": String(
                  orderError?.message || "Provider synchronization failed",
                ).slice(0, 500),
              },
              $inc: { "providerSync.consecutiveFailures": 1 },
            },
          ).catch((metadataError) => {
            console.error("ORDER SYNC METADATA ERROR:", metadataError.message);
          });
        }
      }
    } catch (err) {
      console.error("ORDER SYNC JOB ERROR:", err.message);
    }
  });
};

module.exports = startOrderSyncJob;
