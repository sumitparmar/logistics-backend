const { ORDER_STATUS } = require("../engines/status.engine");

function mapBorzoStatus(borzoStatus) {
  switch (String(borzoStatus).toLowerCase()) {
    // ===== BORZO ORDER STATUSES =====
    case "new":
      return ORDER_STATUS.CREATED;

    case "available": // Verified, waiting for courier
      return ORDER_STATUS.CREATED;

    case "reactivated": // Re-available for couriers
      return ORDER_STATUS.CREATED;

    case "delayed": // Delayed by dispatcher
      return ORDER_STATUS.CREATED;

    case "active": // Courier assigned and working
      return ORDER_STATUS.ASSIGNED;

    case "completed": // Order completed
      return ORDER_STATUS.DELIVERED;

    case "canceled": // Borzo spelling
      return ORDER_STATUS.CANCELLED;

    case "cancelled": // Our spelling
      return ORDER_STATUS.CANCELLED;

    // ===== BORZO DELIVERY STATUSES =====
    case "planned":
      return ORDER_STATUS.CREATED;

    case "courier_assigned": // Courier assigned, not departed
      return ORDER_STATUS.ASSIGNED;

    case "courier_departed": // Courier going to pickup
      return ORDER_STATUS.ASSIGNED;

    case "courier_at_pickup": // Courier at pickup point
      return ORDER_STATUS.ASSIGNED;

    case "parcel_picked_up": // Courier picked up parcel
      return ORDER_STATUS.PICKED_UP;

    case "picked_up": // Legacy
      return ORDER_STATUS.PICKED_UP;

    case "courier_arrived": // Courier at drop point
      return ORDER_STATUS.IN_TRANSIT;

    case "delivering": // Legacy
      return ORDER_STATUS.IN_TRANSIT;

    case "finished": // Delivered
      return ORDER_STATUS.DELIVERED;

    case "delivered": // Legacy
      return ORDER_STATUS.DELIVERED;

    case "reattempt_planned":
    case "reattempt_courier_assigned":
    case "reattempt_courier_departed":
    case "reattempt_courier_picked_up":
      return ORDER_STATUS.IN_TRANSIT;

    case "reattempt_finished":
      return ORDER_STATUS.DELIVERED;

    case "return_planned":
    case "return_courier_assigned":
    case "return_courier_departed":
    case "return_courier_picked_up":
      return ORDER_STATUS.IN_TRANSIT;

    case "return_finished":
      return ORDER_STATUS.CANCELLED;

    case "draft":
    case "invalid":
    case "deleted":
      return ORDER_STATUS.FAILED;

    default:
      return null;
  }
}

module.exports = { mapBorzoStatus };
