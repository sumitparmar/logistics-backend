const DEFAULT_BORZO_VEHICLE = 8;
const VALID_BORZO_VEHICLE_IDS = [1, 2, 3, 5, 8];

function isBorzoNotificationEnabled() {
  return String(process.env.BORZO_SEND_NOTIFICATIONS || "true") !== "false";
}

function normalizeBorzoPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

function toISTString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date(date.getTime() + 330 * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+05:30`;
}

function isEndOfDay(data) {
  return data.deliveryType === "EOD" || data.deliveryType === "END_OF_DAY";
}

function resolveVehicleId(vehicleTypeId) {
  const id = Number(vehicleTypeId);
  return VALID_BORZO_VEHICLE_IDS.includes(id) ? id : DEFAULT_BORZO_VEHICLE;
}

// function applyPaymentMethod(payload, payment = {}) {
//   const method = String(payment.method || "").toUpperCase();

//   if (!method || method === "CASH") {
//     return;
//   }

//   if (method === "BANK_CARD" || method === "CARD") {
//     if (!payment.bankCardId && !payment.bank_card_id) {
//       throw new Error("bankCardId is required for bank card payment");
//     }

//     payload.payment_method = "bank_card";
//     payload.bank_card_id = Number(payment.bankCardId || payment.bank_card_id);
//     return;
//   }

//   if (method === "WALLET" || method === "BALANCE") {
//     payload.payment_method = "balance";
//   }
// }

function applyPaymentMethod(payload, payment = {}) {
  const method = String(payment.method || "").toUpperCase();

  // CASH PAYMENT
  if (!method || method === "CASH") {
    // Use provider default payment method
    // Do not explicitly send payment_method for cash
    delete payload.payment_method;
    delete payload.bank_card_id;

    return;
  }

  // CARD PAYMENT
  if (method === "BANK_CARD" || method === "CARD") {
    const bankCardId = payment.bankCardId || payment.bank_card_id;

    if (!bankCardId) {
      throw new Error("bankCardId is required for bank card payment");
    }

    payload.payment_method = "bank_card";
    payload.bank_card_id = Number(bankCardId);

    return;
  }

  // WALLET / BALANCE
  if (method === "WALLET" || method === "BALANCE") {
    payload.payment_method = "balance";

    delete payload.bank_card_id;
  }
}

function applyCashPaymentPoint(payload, payment = {}) {
  const method = String(payment.method || "CASH").toUpperCase();

  if (method && method !== "CASH") {
    return;
  }

  if (!Array.isArray(payload.points) || payload.points.length < 2) {
    return;
  }

  const feePayer = String(payment.feePayer || "DROP").toUpperCase();
  const pointIndex = feePayer === "PICKUP" ? 0 : payload.points.length - 1;

  payload.points[pointIndex].is_order_payment_here = true;
}

function getDeliveryStops(data) {
  const stopDrops = Array.isArray(data.stops)
    ? data.stops.filter((stop) => stop.type === "DROP")
    : [];

  if (stopDrops.length) return stopDrops;

  return [
    {
      ...data.drop,
      name: data.drop?.name || data.customer?.name || null,
      phone: data.drop?.phone || data.customer?.phone || null,
      notes: data.drop?.notes || null,
    },
  ];
}

function assertEndOfDayPointCount(data) {
  if (isEndOfDay(data) && getDeliveryStops(data).length !== 1) {
    throw new Error("End-of-day delivery supports exactly one drop address");
  }
}

function mapDeliveryStops(data, { includeContacts = false } = {}) {
  return getDeliveryStops(data).map((stop) => {
    const point = {
      address: stop.address,
    };

    if (stop.lat !== undefined && stop.lat !== null) {
      point.latitude = String(stop.lat);
    }

    if (stop.lng !== undefined && stop.lng !== null) {
      point.longitude = String(stop.lng);
    }

    // Borzo EOD restriction cleanup
    delete point.required_start_datetime;
    delete point.required_finish_datetime;

    if (includeContacts) {
      point.contact_person = {
        name: stop.name || data.customer?.name || null,
        phone: normalizeBorzoPhone(stop.phone || data.customer?.phone),
      };
      point.note = stop.notes || stop.note || null;
    }

    return point;
  });
}

function applySchedule(payload, scheduledAt) {
  if (!scheduledAt) {
    throw new Error("scheduledAt is required for scheduled delivery");
  }

  const scheduled = new Date(scheduledAt);

  if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
    throw new Error("Scheduled time must be future");
  }

  payload.type = "standard";
  payload.points[0].required_start_datetime = toISTString(scheduled);
  payload.points[0].required_finish_datetime = toISTString(
    new Date(scheduled.getTime() + 30 * 60 * 1000),
  );
}

const mapCalculatePayload = (data) => {
  if (!data.matter) {
    throw new Error("matter is required");
  }

  if (!data.pickup?.address || !data.drop?.address) {
    throw new Error("pickup.address and drop.address are required");
  }

  assertEndOfDayPointCount(data);

  const payload = {
    matter: data.matter,

    vehicle_type_id: resolveVehicleId(data.vehicleTypeId),

    is_client_notification_enabled: isBorzoNotificationEnabled(),

    is_contact_person_notification_enabled: isBorzoNotificationEnabled(),

    total_weight_kg: Number(data.package?.weight || 0),

    insurance_amount: data.package?.declaredValue
      ? String(Number(data.package.declaredValue).toFixed(2))
      : "0.00",

    points: [
      {
        address: data.pickup.address,

        ...(data.pickup.lat !== undefined && data.pickup.lat !== null
          ? {
              latitude: String(data.pickup.lat),
            }
          : {}),

        ...(data.pickup.lng !== undefined && data.pickup.lng !== null
          ? {
              longitude: String(data.pickup.lng),
            }
          : {}),
      },

      ...mapDeliveryStops(data, {
        includeContacts: false,
      }),
    ],
  };

  applyPaymentMethod(payload, data.payment);

  applyCashPaymentPoint(payload, data.payment);

  // SCHEDULED DELIVERY
  if (data.deliveryType === "SCHEDULED") {
    applySchedule(payload, data.scheduledAt);
  }

  // END OF DAY DELIVERY
  if (isEndOfDay(data)) {
    payload.type = "endofday";

    payload.total_weight_kg = Number(data.package?.weight || 1);

    // Borzo restriction:
    // vehicle_type_id prohibited
    delete payload.vehicle_type_id;

    // Borzo restriction:
    // schedule fields prohibited
    payload.points = payload.points.map((point) => {
      const cleanPoint = { ...point };

      delete cleanPoint.required_start_datetime;

      delete cleanPoint.required_finish_datetime;

      return cleanPoint;
    });
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

  assertEndOfDayPointCount(data);

  const deliveryPoints = mapDeliveryStops(data, {
    includeContacts: true,
  });

  if (
    data.pickup?.lat === undefined ||
    data.pickup?.lat === null ||
    data.pickup?.lng === undefined ||
    data.pickup?.lng === null
  ) {
    throw new Error("Valid pickup coordinates are required");
  }

  if (
    deliveryPoints.some(
      (point) =>
        point.latitude === undefined ||
        point.latitude === null ||
        point.longitude === undefined ||
        point.longitude === null,
    )
  ) {
    throw new Error("Valid coordinates are required for every drop address");
  }

  const pickupPoint = {
    address: data.pickup.address,

    latitude: String(data.pickup.lat),

    longitude: String(data.pickup.lng),

    contact_person: {
      name: data.customer.name || null,

      phone: normalizeBorzoPhone(data.customer.phone),
    },

    note: data.pickup?.notes || data.pickupNotes || null,
  };

  // COD
  if (data.cod?.amount) {
    const codPoint = deliveryPoints[deliveryPoints.length - 1];

    codPoint.is_cod_cash_voucher_required = true;

    codPoint.taking_amount = Number(data.cod.amount).toFixed(2);
  }

  const payload = {
    matter: data.matter,

    vehicle_type_id: resolveVehicleId(data.vehicleTypeId),

    is_client_notification_enabled: isBorzoNotificationEnabled(),

    is_contact_person_notification_enabled: isBorzoNotificationEnabled(),

    total_weight_kg: Number(data.package?.weight || 0),

    insurance_amount: data.package?.declaredValue
      ? String(Number(data.package.declaredValue).toFixed(2))
      : "0.00",

    points: [pickupPoint, ...deliveryPoints],
  };

  applyPaymentMethod(payload, data.payment);

  applyCashPaymentPoint(payload, data.payment);

  // SCHEDULED DELIVERY
  if (data.deliveryType === "SCHEDULED") {
    applySchedule(payload, data.scheduledAt);
  }

  // END OF DAY DELIVERY
  if (isEndOfDay(data)) {
    payload.type = "endofday";

    payload.total_weight_kg = Number(data.package?.weight || 1);

    // Borzo restriction:
    // vehicle_type_id prohibited
    delete payload.vehicle_type_id;

    // Borzo restriction:
    // schedule fields prohibited
    payload.points = payload.points.map((point) => {
      const cleanPoint = { ...point };

      delete cleanPoint.required_start_datetime;

      delete cleanPoint.required_finish_datetime;

      return cleanPoint;
    });
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

  const providerOrder =
    existingOrder?.rawProviderResponse?.order ||
    existingOrder?.rawProviderResponse?.orders?.[0];

  if (data.points && providerOrder?.points) {
    const isExistingEndOfDay =
      existingOrder?.deliveryType === "END_OF_DAY" ||
      existingOrder?.deliveryType === "EOD";

    payload.points = data.points
      .map((p, index) => {
        const existingPoint = providerOrder.points[index];
        if (!existingPoint) return null;

        const point = {
          point_id: existingPoint.point_id,
          address: p.address,
          latitude: String(p.latitude),
          longitude: String(p.longitude),
          contact_person: {
            name: existingPoint.contact_person?.name || null,
            phone: normalizeBorzoPhone(existingPoint.contact_person?.phone),
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

        if (!isExistingEndOfDay) {
          if (existingPoint.required_start_datetime) {
            point.required_start_datetime =
              existingPoint.required_start_datetime;
          }
          if (existingPoint.required_finish_datetime) {
            point.required_finish_datetime =
              existingPoint.required_finish_datetime;
          }
        }

        return point;
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
