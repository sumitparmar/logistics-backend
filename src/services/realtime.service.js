const { getIO } = require("../config/socket");

const emitOrderUpdate = (userId, order) => {
  try {
    const io = getIO();

    io.to(`user:${userId}`).emit("order-status-update", {
      orderId: order._id,
      status: order.status,
    });
  } catch (err) {
    console.error("Socket emit failed:", err.message);
  }
};

module.exports = {
  emitOrderUpdate,
};
