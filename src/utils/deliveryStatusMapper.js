const mapDeliveryStatus = (status) => {
  const map = {
    planned: "CREATED",

    courier_assigned: "ASSIGNED",
    courier_departed: "ASSIGNED",
    courier_at_pickup: "ASSIGNED",

    picked_up: "PICKED_UP",
    parcel_picked_up: "PICKED_UP",

    delivering: "IN_TRANSIT",
    active: "IN_TRANSIT",
    courier_arrived: "IN_TRANSIT",
    reattempt_planned: "IN_TRANSIT",
    reattempt_courier_assigned: "IN_TRANSIT",
    reattempt_courier_departed: "IN_TRANSIT",
    reattempt_courier_picked_up: "IN_TRANSIT",
    return_planned: "IN_TRANSIT",
    return_courier_assigned: "IN_TRANSIT",
    return_courier_departed: "IN_TRANSIT",
    return_courier_picked_up: "IN_TRANSIT",

    finished: "DELIVERED",
    delivered: "DELIVERED",
    reattempt_finished: "DELIVERED",

    canceled: "CANCELLED",
    cancelled: "CANCELLED",
    return_finished: "CANCELLED",

    draft: "FAILED",
    invalid: "FAILED",
    deleted: "FAILED",
  };

  return map[String(status).toLowerCase()] || null;
};

module.exports = mapDeliveryStatus;
