const { ORDER_STATUS } = require("../engines/status.engine");

function mapBorzoStatus(borzoStatus) {
  switch (borzoStatus) {
    case "new":
      return ORDER_STATUS.CREATED;

    case "courier_assigned":
      return ORDER_STATUS.ASSIGNED;

    case "picked_up":
      return ORDER_STATUS.PICKED_UP;

    case "delivering":
      return ORDER_STATUS.IN_TRANSIT;

    case "delivered":
      return ORDER_STATUS.DELIVERED;

    case "canceled":
      return ORDER_STATUS.CANCELLED;

    case "planned":
      return ORDER_STATUS.ASSIGNED;

    case "cancelled":
      return ORDER_STATUS.CANCELLED;

    default:
      return ORDER_STATUS.CREATED;
  }
}

module.exports = { mapBorzoStatus };
