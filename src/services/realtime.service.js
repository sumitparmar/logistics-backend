const { getIO } = require("../config/socket");

const emitOrderUpdate = (userId, order, options = {}) => {
  try {
    const io = getIO();
    const payload = {
      orderId: order._id,
      status: order.status,
      courier: order.courier || null,
      delivery: order.delivery || null,
      updatedAt: new Date(),
    };

    if (userId) {
      io.to(`user:${userId}`).emit("order-status-update", payload);
    }

    io.to(`order:${order._id}`).emit("order-status-update", payload);

    if (options.admin) {
      io.to("admin").emit("admin-order-update", {
        ...payload,
        data: order,
      });
    }
  } catch (err) {
    console.error("Socket emit failed:", err.message);
  }
};

module.exports = {
  emitOrderUpdate,
};
