const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mapCalculatePayload,
  mapCreateOrderPayload,
  mapEditPayload,
} = require("../src/mappers/borzoOrder.mapper");

const baseOrder = {
  matter: "Documents",
  vehicleTypeId: 8,
  deliveryType: "NOW",
  customer: { name: "Test User", phone: "9999999999" },
  pickup: { address: "Pickup, New Delhi", lat: 28.5, lng: 77.2 },
  drop: { address: "Drop, New Delhi", lat: 28.6, lng: 77.3 },
  package: { weight: 1, declaredValue: 0 },
  payment: { method: "CASH", feePayer: "DROP" },
};

test("standard Borzo calculation uses the authenticated vehicle id", () => {
  const payload = mapCalculatePayload(baseOrder);

  assert.equal(payload.type, undefined);
  assert.equal(payload.vehicle_type_id, 8);
  assert.equal(payload.total_weight_kg, 1);
});

test("unsupported standard vehicle ids are rejected before the provider call", () => {
  assert.throws(
    () => mapCalculatePayload({ ...baseOrder, vehicleTypeId: 1 }),
    /Unsupported vehicle type/,
  );
});

test("end-of-day payload omits vehicle type and keeps the required weight", () => {
  const payload = mapCalculatePayload({
    ...baseOrder,
    deliveryType: "END_OF_DAY",
    vehicleTypeId: 1,
  });

  assert.equal(payload.type, "endofday");
  assert.equal(payload.vehicle_type_id, undefined);
  assert.equal(payload.total_weight_kg, 1);
});

test("end-of-day payload rejects missing or non-positive weight", () => {
  assert.throws(
    () =>
      mapCalculatePayload({
        ...baseOrder,
        deliveryType: "EOD",
        package: { ...baseOrder.package, weight: 0 },
      }),
    /positive package weight is required/,
  );
});

test("COD amount uses Borzo cash-voucher fields on the drop point", () => {
  const payload = mapCreateOrderPayload({
    ...baseOrder,
    cod: { amount: 500 },
    idempotencyKey: "client-request-key-123456789",
  });

  assert.equal(payload.points[1].is_cod_cash_voucher_required, true);
  assert.equal(payload.points[1].taking_amount, "500.00");
  assert.equal(payload.points[1].is_order_payment_here, true);
  assert.match(payload.points[0].client_order_id, /^mk_[a-f0-9]{29}$/);
  assert.equal(
    payload.points[0].client_order_id,
    payload.points[1].client_order_id,
  );
});

test("edit payload preserves Borzo point ids and does not invent them", () => {
  const existing = {
    deliveryType: "NOW",
    rawProviderResponse: {
      order: {
        points: [
          {
            point_id: 101,
            contact_person: { phone: "919999999999" },
            packages: [{ order_package_id: 201, items_count: 1 }],
          },
          {
            point_id: 102,
            contact_person: { phone: "919999999999" },
            packages: [{ order_package_id: 202, items_count: 1 }],
          },
        ],
      },
    },
  };

  const payload = mapEditPayload(
    "12345",
    {
      matter: "Updated documents",
      total_weight_kg: 2,
      points: [
        { address: "Updated pickup", latitude: 28.5, longitude: 77.2 },
        { address: "Updated drop", latitude: 28.6, longitude: 77.3 },
      ],
    },
    existing,
  );

  assert.deepEqual(
    payload.points.map((point) => point.point_id),
    [101, 102],
  );
  assert.deepEqual(
    payload.points.map((point) => point.packages[0].order_package_id),
    [201, 202],
  );
});

test("end-of-day edit omits vehicle type and validates weight", () => {
  const existing = {
    deliveryType: "END_OF_DAY",
    rawProviderResponse: { order: { points: [] } },
  };

  const payload = mapEditPayload(
    "12345",
    { vehicleTypeId: 8, total_weight_kg: 3 },
    existing,
  );

  assert.equal(payload.vehicle_type_id, undefined);
  assert.equal(payload.total_weight_kg, 3);
  assert.throws(
    () => mapEditPayload("12345", { total_weight_kg: 0 }, existing),
    /positive package weight is required/,
  );
});
