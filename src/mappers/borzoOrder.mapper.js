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
    vehicle_type_id: vehicleId,
    points: [{ address: data.pickup.address }, { address: data.drop.address }],
  };
  if (data.deliveryType === "EOD") {
    payload.type = "endofday";
  }

  if (data.deliveryType === "SCHEDULED") {
    if (!data.scheduledAt) {
      throw new Error("scheduledAt is required for scheduled delivery");
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
    vehicle_type_id: vehicleId,
    points: [pickupPoint, dropPoint],
  };

  if (data.deliveryType === "EOD") {
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

const mapEditPayload = (borzoOrderId, data, existingOrder) => {
  const payload = {
    order_id: Number(borzoOrderId),
  };

  // ✅ SAFE FIELDS
  if (data.matter) {
    payload.matter = data.matter;
  }

  if (data.total_weight_kg !== undefined) {
    payload.total_weight_kg = Number(data.total_weight_kg);
  }

  if (data.vehicle_type_id) {
    payload.vehicle_type_id = Number(data.vehicle_type_id);
  }

  // ❗ CRITICAL: handle points correctly
  if (data.points && existingOrder?.rawProviderResponse?.order?.points) {
    payload.points = data.points.map((p, index) => {
      const existingPoint =
        existingOrder.rawProviderResponse.order.points[index];

      return {
        point_id: existingPoint.point_id, // REQUIRED by Borzo
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
      };
    });
  }

  return payload;
};

module.exports = {
  mapCalculatePayload,
  mapCreateOrderPayload,
  mapEditPayload,
};
