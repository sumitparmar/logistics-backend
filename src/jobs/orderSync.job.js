const cron = require("node-cron");
const Order = require("../models/Order");
const pulseService = require("../services/pulse.service");
const { transitionStatus } = require("../engines/status.engine");
const { mapBorzoStatus } = require("../utils/statusMapper");
const { getIO } = require("../config/socket");
const startOrderSyncJob = () => {
  cron.schedule("*/2 * * * *", async () => {
    try {
      const orders = await Order.find({
        status: { $nin: ["DELIVERED", "CANCELLED", "FAILED"] },
      }).limit(50);

      for (const order of orders) {
        console.log("CRON SYNC CHECK:", order._id, order.status);

        const response = await pulseService.getOrder(order.borzoOrderId);

        if (
          !response?.is_successful ||
          !response.orders ||
          response.orders.length === 0
        ) {
          continue;
        }

        const borzoOrder = response.orders[0];

        const deliveryStatus =
          borzoOrder.points?.find((p) => p.delivery)?.delivery?.status || null;

        const mappedStatus = mapBorzoStatus(
          deliveryStatus || borzoOrder.status,
        );

        const nextStatus = transitionStatus(order.status, mappedStatus);

        if (nextStatus !== order.status) {
          order.status = nextStatus;
          order.statusHistory.push({ status: nextStatus });

          const savedOrder = await order.save();

          const io = getIO();
          io.to(`user:${savedOrder.user}`).emit("order-status-update", {
            orderId: savedOrder._id,
            status: savedOrder.status,
          });
        }
      }
    } catch (err) {
      console.error("ORDER SYNC JOB ERROR:", err.message);
    }
  });
};

module.exports = startOrderSyncJob;
