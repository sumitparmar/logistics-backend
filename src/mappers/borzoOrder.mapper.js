const DEFAULT_BORZO_VEHICLE = 8;

const mapCalculatePayload = (data) => {
  if (!data.matter) {
    throw new Error("matter is required");
  }

  if (!data.pickup?.address || !data.drop?.address) {
    throw new Error("pickup.address and drop.address are required");
  }

  const allowedVehicles = [DEFAULT_BORZO_VEHICLE];

  const vehicleId = allowedVehicles.includes(Number(data.vehicleTypeId))
    ? Number(data.vehicleTypeId)
    : DEFAULT_BORZO_VEHICLE;

  const payload = {
    matter: data.matter,
    points: [
      {
        address: data.pickup.address,
        latitude: data.pickup.lat || null,
        longitude: data.pickup.lng || null,
        contact_person: {
          name: data.customer?.name || null,
          phone: data.customer?.phone || null,
        },
      },
      {
        address: data.drop.address,
        latitude: data.drop.lat || null,
        longitude: data.drop.lng || null,
        contact_person: {
          name: data.customer?.name || null,
          phone: data.customer?.phone || null,
        },
      },
    ],
  };

  // STANDARD
  if (data.deliveryType !== "EOD" && data.deliveryType !== "END_OF_DAY") {
    payload.vehicle_type_id = vehicleId;
  }

  // COD
  if (data.cod?.amount) {
    payload.points[1].taking_amount = Number(data.cod.amount);
    payload.points[1].is_cod_cash_voucher_required = true;
  }

  // EOD (CRITICAL)
  if (data.package?.weight) {
    payload.total_weight_kg = Number(data.package.weight);
  }

  // SCHEDULED
  if (data.deliveryType === "SCHEDULED") {
    if (!data.scheduledAt) {
      throw new Error("scheduledAt is required");
    }

    const scheduled = new Date(data.scheduledAt);

    payload.type = "standard";

    payload.points[0].required_start_datetime = scheduled.toISOString();
    payload.points[0].required_finish_datetime = new Date(
      scheduled.getTime() + 30 * 60 * 1000,
    ).toISOString();
  }
  return payload;
};

const mapCreateOrderPayload = (data) => {
  if (!data.matter) {
    throw new Error("matter is required");
  }

  if (!data.customer?.phone) {
    throw new Error("customer.phone is required");
  }

  if (!data.pickup?.address || !data.drop?.address) {
    throw new Error("pickup.address and drop.address are required");
  }

  const pickupPoint = {
    address: data.pickup.address,
    latitude: data.pickup.lat || null,
    longitude: data.pickup.lng || null,
    contact_person: {
      name: data.customer.name || null,
      phone: data.customer.phone,
    },
  };

  const dropPoint = {
    address: data.drop.address,
    latitude: data.drop.lat || null,
    longitude: data.drop.lng || null,
    contact_person: {
      name: data.customer.name || null,
      phone: data.customer.phone,
    },
  };

  //  COD Injection
  if (data.cod?.amount) {
    dropPoint.is_cod_cash_voucher_required = true;
    dropPoint.taking_amount = Number(data.cod.amount);
  }

  const allowedVehicles = [DEFAULT_BORZO_VEHICLE];

  const vehicleId = allowedVehicles.includes(Number(data.vehicleTypeId))
    ? Number(data.vehicleTypeId)
    : DEFAULT_BORZO_VEHICLE;

  const payload = {
    matter: data.matter,
    points: [pickupPoint, dropPoint],
  };

  // ONLY add vehicle for standard
  if (data.deliveryType !== "EOD" && data.deliveryType !== "END_OF_DAY") {
    payload.vehicle_type_id = vehicleId;
  }

  if (data.package?.weight) {
    payload.total_weight_kg = Number(data.package.weight);
  }

  if (data.deliveryType === "EOD" || data.deliveryType === "END_OF_DAY") {
    payload.type = "endofday";
  }

  if (data.deliveryType === "SCHEDULED") {
    if (!data.scheduledAt) {
      throw new Error("scheduledAt is required");
    }

    const scheduled = new Date(data.scheduledAt);

    // keep type as standard (or don't set at all)
    payload.type = "standard";

    // apply timing on PICKUP point
    payload.points[0].required_start_datetime = scheduled.toISOString();

    // recommended: 30 min window
    payload.points[0].required_finish_datetime = new Date(
      scheduled.getTime() + 30 * 60 * 1000,
    ).toISOString();
  }

  return payload;
};

const mapEditPayload = (borzoOrderId, data) => {
  return {
    order_id: Number(borzoOrderId),
    ...data,
  };
};

module.exports = {
  mapCalculatePayload,
  mapCreateOrderPayload,
  mapEditPayload,
};
