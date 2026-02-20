const mapCalculatePayload = (data) => {
  if (!data.matter) {
    throw new Error("matter is required");
  }

  if (!data.pickup?.address || !data.drop?.address) {
    throw new Error("pickup.address and drop.address are required");
  }

  return {
    matter: data.matter,
    vehicle_type_id: data.vehicleTypeId || 8,

    points: [{ address: data.pickup.address }, { address: data.drop.address }],
  };
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

  return {
    matter: data.matter,
    vehicle_type_id: data.vehicleTypeId || 8,

    points: [
      {
        address: data.pickup.address,
        latitude: data.pickup.lat || null,
        longitude: data.pickup.lng || null,
        contact_person: {
          name: data.customer.name || null,
          phone: data.customer.phone,
        },
      },
      {
        address: data.drop.address,
        latitude: data.drop.lat || null,
        longitude: data.drop.lng || null,
        contact_person: {
          name: data.customer.name || null,
          phone: data.customer.phone,
        },
      },
    ],
  };
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
