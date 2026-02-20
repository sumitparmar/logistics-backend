const mapDeliveryStatus = (status) => {
  const map = {
    planned: "CREATED",

    courier_assigned: "ASSIGNED",

    picked_up: "PICKED_UP", // ✅ ADD THIS
    parcel_picked_up: "PICKED_UP", // keep

    delivering: "IN_TRANSIT",
    active: "IN_TRANSIT",

    finished: "DELIVERED",
    delivered: "DELIVERED",

    canceled: "CANCELLED",
    cancelled: "CANCELLED",
  };

  return map[status] || null;
};

module.exports = mapDeliveryStatus;
