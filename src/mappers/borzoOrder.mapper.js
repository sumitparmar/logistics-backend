const DEFAULT_BORZO_VEHICLE = 8;

const mapCalculatePayload = (data) => {
  if (!data.matter) {
    throw new Error("matter is required");
  }

  if (!data.pickup?.address || !data.drop?.address) {
    throw new Error("pickup.address and drop.address are required");
  }

  const VALID_VEHICLE_IDS = [1, 2, 3, 5, 8];

  const vehicleId = VALID_VEHICLE_IDS.includes(Number(data.vehicleTypeId))
    ? Number(data.vehicleTypeId)
    : DEFAULT_BORZO_VEHICLE;

  const payload = {
    matter: data.matter,
    vehicle_type_id: vehicleId,
    total_weight_kg: Number(data.package?.weight || 0),
    insurance_amount: data.package?.declaredValue
      ? String(Number(data.package.declaredValue).toFixed(2))
      : "0.00",
    points: [{ address: data.pickup.address }, { address: data.drop.address }],
  };

  if (data.deliveryType === "EOD" || data.deliveryType === "END_OF_DAY") {
    payload.type = "endofday";
    payload.total_weight_kg = Number(data.package?.weight || 1);
    delete payload.vehicle_type_id;
  }

  if (data.deliveryType === "SCHEDULED") {
    if (!data.scheduledAt) {
      throw new Error("scheduledAt is required for scheduled delivery");
    }

    const scheduled = new Date(data.scheduledAt);

    if (scheduled.getTime() <= Date.now()) {
      throw new Error("Scheduled time must be future");
    }
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

  if (
    !data.pickup?.lat ||
    !data.pickup?.lng ||
    !data.drop?.lat ||
    !data.drop?.lng
  ) {
    throw new Error("Valid pickup and drop coordinates are required");
  }

  const pickupPoint = {
    address: data.pickup.address,
    latitude: data.pickup.lat || null,
    longitude: data.pickup.lng || null,
    contact_person: {
      name: data.customer.name || null,
      phone: data.customer.phone,
    },
    note: data.pickup?.notes || data.pickupNotes || null,
  };

  const dropPoint = {
    address: data.drop.address,
    latitude: data.drop.lat || null,
    longitude: data.drop.lng || null,
    contact_person: {
      name: data.customer.name || null,
      phone: data.customer.phone,
    },
    note: data.drop?.notes || data.stops?.[1]?.notes || null,
  };

  //  COD Injection
  if (data.cod?.amount) {
    dropPoint.is_cod_cash_voucher_required = true;
    dropPoint.taking_amount = Number(data.cod.amount);
  }
  const VALID_VEHICLE_IDS = [1, 2, 3, 5, 8];

  const vehicleId = VALID_VEHICLE_IDS.includes(Number(data.vehicleTypeId))
    ? Number(data.vehicleTypeId)
    : DEFAULT_BORZO_VEHICLE;

  const payload = {
    matter: data.matter,
    vehicle_type_id: vehicleId,
    total_weight_kg: Number(data.package?.weight || 0),
    insurance_amount: data.package?.declaredValue
      ? String(Number(data.package.declaredValue).toFixed(2))
      : "0.00",
    points: [pickupPoint, dropPoint],
  };
  if (data.deliveryType === "EOD" || data.deliveryType === "END_OF_DAY") {
    payload.type = "endofday";
    payload.total_weight_kg = Number(data.package?.weight || 1);
    delete payload.vehicle_type_id;
  }

  if (data.deliveryType === "SCHEDULED") {
    if (!data.scheduledAt) {
      throw new Error("scheduledAt is required");
    }

    const scheduled = new Date(data.scheduledAt);

    if (scheduled.getTime() <= Date.now()) {
      throw new Error("Scheduled time must be future");
    }
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

  if (data.matter) {
    payload.matter = data.matter;
  }

  if (data.total_weight_kg !== undefined) {
    payload.total_weight_kg = Number(data.total_weight_kg);
  }

  if (data.vehicle_type_id) {
    payload.vehicle_type_id = Number(data.vehicle_type_id);
  }

  if (data.points && existingOrder?.rawProviderResponse?.order?.points) {
    payload.points = data.points
      .map((p, index) => {
        const existingPoint =
          existingOrder.rawProviderResponse.order.points[index];

        if (!existingPoint) return null;

        return {
          point_id: existingPoint.point_id,
          address: p.address,
          latitude: String(p.latitude),
          longitude: String(p.longitude),
          contact_person: {
            name: existingPoint.contact_person?.name || null,
            phone: existingPoint.contact_person?.phone || null,
          },
          packages: (existingPoint.packages || []).map((pkg) => ({
            order_package_id: pkg.order_package_id,
            items_count: pkg.items_count,
          })),
          note: p.note || existingPoint.note || null,
          taking_amount: String(
            Number(p.taking_amount || existingPoint.taking_amount || 0).toFixed(
              2,
            ),
          ),
          buyout_amount: String(
            Number(p.buyout_amount || existingPoint.buyout_amount || 0).toFixed(
              2,
            ),
          ),
        };
      })
      .filter(Boolean);
  }

  return payload;
};

module.exports = {
  mapCalculatePayload,
  mapCreateOrderPayload,
  mapEditPayload,
};
