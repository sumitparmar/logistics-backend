const mapDeliveryStatus = (status) => {
  const map = {
    planned: "CREATED",

    courier_assigned: "ASSIGNED",

    picked_up: "PICKED_UP",
    parcel_picked_up: "PICKED_UP",

    delivering: "IN_TRANSIT",
    active: "IN_TRANSIT",

    finished: "DELIVERED",
    delivered: "DELIVERED",

    canceled: "CANCELLED",
    cancelled: "CANCELLED",
  };

  return map[String(status).toLowerCase()] || null;
};

module.exports = mapDeliveryStatus;
