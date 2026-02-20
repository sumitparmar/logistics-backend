const ORDER_STATUS = {
  CREATED: "CREATED",
  ASSIGNED: "ASSIGNED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
};

// strict order of lifecycle
const STATUS_ORDER = [
  ORDER_STATUS.CREATED,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.FAILED,
  ORDER_STATUS.CANCELLED,
];

function transitionStatus(currentStatus, nextStatus) {
  // first ever status
  if (!currentStatus) return nextStatus;

  // same status
  if (currentStatus === nextStatus) return currentStatus;

  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = STATUS_ORDER.indexOf(nextStatus);

  // unknown statuses
  if (currentIndex === -1 || nextIndex === -1) {
    console.warn(`Unknown status received: ${currentStatus} → ${nextStatus}`);
    return currentStatus;
  }

  // backward webhook → ignore silently
  if (nextIndex < currentIndex) {
    console.log(`Ignoring backward status ${currentStatus} → ${nextStatus}`);
    return currentStatus;
  }

  // forward movement
  return nextStatus;
}

module.exports = {
  ORDER_STATUS,
  transitionStatus,
};
