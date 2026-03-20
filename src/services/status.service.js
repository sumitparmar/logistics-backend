const { transitionStatus } = require("../engines/status.engine");

function applyStatusUpdate(order, newStatus) {
  const finalStatus = transitionStatus(order.status, newStatus);

  if (finalStatus !== order.status) {
    order.status = finalStatus;

    order.statusHistory.push({
      status: finalStatus,
      updatedAt: new Date(),
    });
  }

  return order;
}

module.exports = {
  applyStatusUpdate,
};
