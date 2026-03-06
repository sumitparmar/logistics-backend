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

  if (data.orderType === "END_OF_DAY") {
    payload.type = "endofday";
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

  // End-of-day order
  if (data.orderType === "END_OF_DAY") {
    payload.type = "endofday";
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
