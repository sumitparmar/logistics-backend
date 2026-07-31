const Order = require("../models/Order");
const pulseService = require("./pulse.service");
const { transitionStatus } = require("../engines/status.engine");
const {
  mapProviderError,
  throwProviderError,
} = require("../utils/providerErrorMapper");
const { mapBorzoStatus } = require("../utils/statusMapper");
const mapDeliveryStatus = require("../utils/deliveryStatusMapper");
const AdminPricing = require("../models/adminPricing.model");
const { applyAdminPricing } = require("./adminPricing.service");
const LedgerEntry = require("../models/LedgerEntry");
const {
  mapCreateOrderPayload,
  mapCalculatePayload,
  mapEditPayload,
} = require("../mappers/borzoOrder.mapper");
const { getVehicleTypes } = require("./providerCatalog.service");
const {
  notifyOrderCreated,
  notifyOrderDelivered,
} = require("./deliveryNotification.service");
const { emitOrderUpdate } = require("./realtime.service");

const {
  createCustomerNotification,
} = require("./customerNotification.service");
const mongoose = require("mongoose");

const { debitWallet, creditWallet, getWallet } = require("./wallet.service");
const toMoneyNumber = (value) => Number(Number(value || 0).toFixed(2));

// CREATE ORDER

const createOrderService = async (data) => {
  if (!data.user) {
    throw new Error("User is required");
  }

  if (data.deliveryType === "SCHEDULED") {
    data.scheduledAt =
      data.scheduledAt || data.scheduleDateTime || data.schedule || null;

    if (!data.scheduledAt) {
      throw new Error("scheduledAt missing at service level");
    }
  }

  const dropStops =
    Array.isArray(data.stops) && data.stops.length > 0
      ? data.stops.filter((s) => s.type === "DROP")
      : [
          {
            type: "DROP",
            ...data.drop,
            name: data.drop?.name || null,
            phone: data.drop?.phone || null,
          },
        ];

  const stops = [
    {
      type: "PICKUP",
      ...data.pickup,
      name: data.customer?.name,
      phone: data.customer?.phone,
    },
    ...dropStops,
  ];

  const recentExisting = await Order.findOne({
    user: data.user,
    "pickup.address": data.pickup?.address,
    "drop.address": data.drop?.address,
    createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
  }).sort({ createdAt: -1 });

  if (
    recentExisting &&
    ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(
      recentExisting.status,
    ) &&
    String(recentExisting.vehicleTypeId) === String(data.vehicleTypeId)
  ) {
    const err = new Error("Similar order already created recently");
    err.statusCode = 409;
    throw err;
  }

  // Delivery Type
  data.deliveryType = data.deliveryType || "NOW";

  // Package
  data.package = data.package || {
    weight: null,
    category: null,
    description: null,
    declaredValue: data.declaredValue || null,
  };

  // matter sync — Borzo mapper requires this
  data.matter = data.matter || data.package?.description || null;

  if (!data.matter) {
    throw new Error("matter / package description is required");
  }

  // Payment
  data.payment = data.payment || {
    method: "CASH",
    feePayer: "DROP",
  };

  data.vehicleTypeId = data.vehicleTypeId || data.vehicleType;

  const vehicles = await getVehicleTypes();

  const validVehicle = vehicles.find(
    (v) => String(v.id) === String(data.vehicleTypeId),
  );
  if (!validVehicle) {
    const err = new Error("Invalid vehicle type");
    err.statusCode = 400;
    throw err;
  }

  // Weight validation
  if (
    validVehicle.maxWeightKg &&
    Number(data.package?.weight) > validVehicle.maxWeightKg
  ) {
    const err = new Error(
      `Weight ${data.package?.weight}kg exceeds ${validVehicle.name} limit of ${validVehicle.maxWeightKg}kg`,
    );
    err.statusCode = 400;
    throw err;
  }

  data.vehicleTypeId = data.vehicleTypeId || data.vehicleType;
  const calculatePayload = mapCalculatePayload(data);
  let priceResponse;

  try {
    priceResponse = await pulseService.calculateOrder(calculatePayload);
  } catch (err) {
    throwProviderError(err);
  }

  if (!priceResponse?.is_successful) {
    throwProviderError(priceResponse);
  }

  if (
    priceResponse?.order?.payment_amount === undefined ||
    priceResponse?.order?.payment_amount === null
  ) {
    throw new Error("Price calculation failed");
  }

  const baseAmount = toMoneyNumber(priceResponse.order.payment_amount);
  const insuranceCharge = toMoneyNumber(
    priceResponse.order.insurance_fee_amount,
  );

  let pricingConfig = await AdminPricing.findOne({ isActive: true });

  if (!pricingConfig) {
    pricingConfig = {
      marginPercent: 0,
      baseFees: { platformFee: 0, handlingFee: 0 },
      surge: { enabled: false },
      vehicleOverrides: [],
    };
  }
  // Step 1: apply admin pricing on base
  let adjustedAmount = baseAmount;

  if (pricingConfig && baseAmount > 0) {
    adjustedAmount = applyAdminPricing({
      basePrice: baseAmount,
      config: pricingConfig,
      vehicleType: String(data.vehicleTypeId),
    });
  }

  const finalAmount = Number(adjustedAmount.toFixed(2));

  const snapshot = {
    marginAmount: Number(
      (baseAmount * ((pricingConfig.marginPercent || 0) / 100)).toFixed(2),
    ),

    platformFeeAmount: Number(
      (pricingConfig.baseFees?.platformFee || 0).toFixed(2),
    ),

    handlingFeeAmount: Number(
      (pricingConfig.baseFees?.handlingFee || 0).toFixed(2),
    ),

    basePrice: baseAmount,

    marginPercent: pricingConfig.marginPercent,

    platformFee: pricingConfig.baseFees?.platformFee || 0,
    handlingFee: pricingConfig.baseFees?.handlingFee || 0,

    surgeMultiplier: pricingConfig.surge?.multiplier || 1,
    surgeApplied: pricingConfig.surge?.enabled || false,

    vehicleType: String(
      priceResponse?.order?.vehicle_type_id || data.vehicleTypeId,
    ),

    vehicleMultiplier:
      pricingConfig.vehicleOverrides?.find(
        (v) => String(v.type) === String(data.vehicleTypeId),
      )?.multiplier || 1,

    insurancePercent: null,

    insuranceFeeAmount: insuranceCharge,

    codFee: Number(priceResponse?.order?.cod_fee_amount || 0),

    finalPrice: finalAmount,
  };
  const sanitizedCreateData = JSON.parse(JSON.stringify(data));

  // Defensive cleanup for EOD Borzo orders
  if (
    sanitizedCreateData.deliveryType === "EOD" ||
    sanitizedCreateData.deliveryType === "END_OF_DAY"
  ) {
    delete sanitizedCreateData.scheduledAt;
    delete sanitizedCreateData.schedule;
    delete sanitizedCreateData.scheduleDateTime;

    if (Array.isArray(sanitizedCreateData.stops)) {
      sanitizedCreateData.stops = sanitizedCreateData.stops.map((stop) => {
        const cleanStop = { ...stop };

        delete cleanStop.required_start_datetime;
        delete cleanStop.required_finish_datetime;

        return cleanStop;
      });
    }
  }

  // Wallet validation
  if (data.payment?.method === "WALLET") {
    const wallet = await getWallet(data.user);

    if (wallet.balance < finalAmount) {
      throw new Error("Insufficient wallet balance");
    }
  }

  let createPayload = mapCreateOrderPayload(sanitizedCreateData);
  let createResponse;

  try {
    createResponse = await pulseService.createOrder(createPayload);
  } catch (err) {
    throwProviderError(err);
  }

  if (!createResponse?.is_successful) {
    const mapped = mapProviderError(createResponse);

    const err = new Error(mapped.message);
    err.statusCode = mapped.status;
    err.code = mapped.code;

    throw err;
  }

  if (!createResponse?.order?.order_id) {
    throw new Error("Invalid Borzo response");
  }

  if (data.payment?.method === "WALLET") {
    try {
      await debitWallet({
        userId: data.user,

        amount: finalAmount,

        reason: "ORDER_PAYMENT",

        category: "ORDER",

        description: `Payment for order ${createResponse.order.order_id}`,

        order: null,

        reference: String(createResponse.order.order_id),

        metadata: {
          provider: "BORZO",
          borzoOrderId: String(createResponse.order.order_id),
        },

        performedBy: data.user,
      });
    } catch (walletError) {
      try {
        await pulseService.cancelOrder({
          order_id: Number(createResponse.order.order_id),
        });
      } catch (cancelError) {
        console.error("Failed to rollback Borzo order:", cancelError.message);
      }

      throw walletError;
    }
  }

  const providerStatus = createResponse.order.status;

  const courier = createResponse?.order?.courier;

  let courierData = null;

  if (courier && (courier.name || courier.phone)) {
    courierData = {
      courierId: courier.courier_id || courier.id || null,
      name: courier.name || null,
      phone: courier.phone || null,
    };
  }

  const vehicleTypeFromProvider =
    createResponse.order.vehicle_type_id || validVehicle.id;
  const mappedStatus = mapBorzoStatus(providerStatus);

  const order = new Order({
    pricingSnapshot: snapshot,
    borzoOrderId: String(createResponse.order.order_id),

    customer: data.customer,
    pickup: data.pickup,
    drop: data.drop,
    courier: courierData,
    stops: stops,
    deliveryType: data.deliveryType,
    vehicleTypeId: data.vehicleTypeId,
    package: data.package,
    payment: data.payment,
    user: data.user,

    vehicle: {
      type: vehicleTypeFromProvider,
    },
    pricing: {
      baseAmount,
      adjustedAmount,
      insurance: insuranceCharge,
      amount: finalAmount,
      currency: process.env.CURRENCY,
      calculatedAt: new Date(),
    },
    cod: {
      enabled: Boolean(data.cod?.amount),
      amount: data.cod?.amount ? Number(data.cod.amount) : 0,
    },

    status: transitionStatus(null, mappedStatus) || "CREATED",

    statusHistory: [
      {
        status: transitionStatus(null, mappedStatus) || "CREATED",
      },
    ],

    provider: "BORZO",

    rawProviderResponse: createResponse,
  });

  const savedOrder = await order.save();

  if (data.payment?.method === "WALLET") {
    await LedgerEntry.findOneAndUpdate(
      {
        reference: String(savedOrder.borzoOrderId),
        order: null,
      },
      {
        $set: {
          order: savedOrder._id,
        },
      },
    );
  }

  notifyOrderCreated(savedOrder).catch(() => {});

  emitOrderUpdate(savedOrder.user, savedOrder, { admin: true });

  setTimeout(async () => {
    try {
      await syncOrderService(savedOrder._id);
    } catch (err) {
      console.error("Auto-sync failed:", err.message);
    }
  }, 10000); // 10 sec delay

  return savedOrder;
};

const getOrdersService = async (userId, query = {}) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);

  const skip = (page - 1) * limit;

  const filter = {};
  const isAdmin = String(query.isAdmin) === "true";

  if (!isAdmin) {
    filter.user = userId;
  }

  if (query.statuses) {
    filter.status = {
      $in: String(query.statuses)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  } else if (query.status) {
    if (query.status === "ACTIVE") {
      filter.status = {
        $in: ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"],
      };
    } else if (String(query.status).includes(",")) {
      filter.status = {
        $in: String(query.status)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    } else {
      filter.status = query.status;
    }
  }

  // SEARCH FILTER
  if (query.search) {
    const regex = new RegExp(query.search, "i");
    filter.$or = [
      { borzoOrderId: regex },
      { "pickup.address": regex },
      { "drop.address": regex },
      { "customer.name": regex },
      { "customer.phone": regex },
    ];
  }

  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const baseFilter = isAdmin ? {} : { user: userId };

  const [orders, total, active, delivered, cancelled] = await Promise.all([
    Order.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),

    Order.countDocuments(filter),
    Order.countDocuments({
      ...baseFilter,
      status: { $in: ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
    }),

    Order.countDocuments({
      ...baseFilter,
      status: "DELIVERED",
    }),

    Order.countDocuments({
      ...baseFilter,
      status: "CANCELLED",
    }),
  ]);

  return {
    data: orders,
    meta: {
      total,
      page,
      limit,
      stats: {
        total,
        active,
        delivered,
        cancelled,
      },
    },
  };
};

// GET SINGLE ORDER

const getOrderByIdService = async (id, userId = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid order id");
    err.statusCode = 400;
    throw err;
  }

  // If called from protected route
  if (userId) {
    return Order.findOne({ _id: id, user: userId });
  }

  // If called from public track route
  return Order.findById(id);
};

const getPublicTrackingOrderService = async (id) => {
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { borzoOrderId: String(id) }] }
    : { borzoOrderId: String(id) };
  const order = await Order.findOne(query);

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const maskPhone = (phone) => {
    const value = String(phone || "");
    if (value.length <= 4) return value;
    return `${value.slice(0, 2)}******${value.slice(-2)}`;
  };

  const providerOrder =
    order.rawProviderResponse?.order || order.rawProviderResponse?.orders?.[0];

  const sanitizedProviderOrder = providerOrder
    ? {
        order_id: providerOrder.order_id,
        status: providerOrder.status,
        matter: providerOrder.matter,
        total_weight_kg: providerOrder.total_weight_kg,
        vehicle_type_id: providerOrder.vehicle_type_id,
        points: (providerOrder.points || []).map((point) => ({
          address: point.address,
          latitude: point.latitude,
          longitude: point.longitude,
          estimated_arrival_datetime: point.estimated_arrival_datetime,
          tracking_url: point.tracking_url,
          delivery: point.delivery
            ? {
                status: point.delivery.status,
                status_datetime: point.delivery.status_datetime,
              }
            : null,
        })),
      }
    : null;

  return {
    _id: order._id,
    borzoOrderId: order.borzoOrderId,
    status: order.status,
    statusHistory: order.statusHistory,
    provider: order.provider,
    deliveryType: order.deliveryType,
    createdAt: order.createdAt,
    customer: {
      name: order.customer?.name || null,
      phone: maskPhone(order.customer?.phone),
    },
    pickup: {
      address: order.pickup?.address || null,
      lat: order.pickup?.lat || null,
      lng: order.pickup?.lng || null,
    },
    drop: {
      address: order.drop?.address || null,
      lat: order.drop?.lat || null,
      lng: order.drop?.lng || null,
    },
    stops: (order.stops || []).map((stop) => ({
      type: stop.type,
      address: stop.address,
      lat: stop.lat,
      lng: stop.lng,
      name: stop.name,
      phone: maskPhone(stop.phone),
    })),
    courier: order.courier
      ? {
          name: order.courier.name,
          surname: order.courier.surname,
          phone: maskPhone(order.courier.phone),
          location: order.courier.location,
        }
      : null,
    vehicle: order.vehicle,
    vehicleTypeId: order.vehicleTypeId,
    package: {
      weight: order.package?.weight || null,
      category: order.package?.category || null,
      description: order.package?.description || null,
    },
    rawProviderResponse: sanitizedProviderOrder
      ? { order: sanitizedProviderOrder }
      : null,
  };
};

// CANCEL ORDER

const cancelOrderService = async (id, userId) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  if (["DELIVERED", "CANCELLED", "FAILED"].includes(order.status)) {
    const err = new Error(`Cannot cancel order in ${order.status} state`);
    err.statusCode = 400;
    throw err;
  }

  const response = await pulseService.cancelOrder({
    order_id: Number(order.borzoOrderId),
  });

  if (!response?.is_successful) {
    const mapped = mapProviderError(response);

    const err = new Error(mapped.message);
    err.statusCode = mapped.status;
    err.code = mapped.code;

    throw err;
  }

  const providerStatus = response.order?.status || "canceled";
  const mappedStatus = mapBorzoStatus(providerStatus);

  order.status = transitionStatus(order.status, mappedStatus);

  if (mappedStatus === "CANCELLED") {
    order.codSettled = false;
  }

  if (
    order.statusHistory.length === 0 ||
    order.statusHistory[order.statusHistory.length - 1].status !== mappedStatus
  ) {
    order.statusHistory.push({ status: mappedStatus });
  }

  order.rawProviderResponse = response;

  if (order.payment?.method === "WALLET" && !order.walletRefunded) {
    await creditWallet({
      userId: order.user,

      amount: order.pricing.amount,

      reason: "ORDER_CANCEL_REFUND",

      category: "REFUND",

      description: `Refund for cancelled order ${order.borzoOrderId}`,

      order: order._id,

      reference: order.borzoOrderId,

      metadata: {
        provider: "BORZO",
      },

      performedBy: order.user,
    });

    order.walletRefunded = true;
  }

  const savedOrder = await order.save();

  emitOrderUpdate(savedOrder.user, savedOrder);

  return savedOrder;
};

// SYNC ORDER

const syncOrderService = async (id, userId) => {
  const order = userId
    ? await Order.findOne({ _id: id, user: userId })
    : await Order.findById(id);
  if (!order) throw new Error("Order not found");
  const response = await pulseService.getOrder(order.borzoOrderId);

  if (
    !response?.is_successful ||
    !response.orders ||
    response.orders.length === 0
  ) {
    throw new Error("Invalid Borzo sync response");
  }

  const borzoOrder = response.orders[0];

  const courier = borzoOrder?.courier;

  if (courier && (courier.name || courier.phone)) {
    order.courier = {
      courierId: courier.courier_id || courier.id || null,
      name: courier.name || null,
      phone: courier.phone || null,
      //  Live location preserve karo
      location: {
        lat:
          courier.latitude !== undefined && courier.latitude !== null
            ? Number(courier.latitude)
            : order.courier?.location?.lat || null,
        lng:
          courier.longitude !== undefined && courier.longitude !== null
            ? Number(courier.longitude)
            : order.courier?.location?.lng || null,
      },
    };
  }

  const backpaymentAmount = Number(borzoOrder.backpayment_amount || 0);
  const codFeeAmount = Number(borzoOrder.cod_fee_amount || 0);

  const borzoStatus = borzoOrder.status;

  const deliveryStatus =
    borzoOrder.points?.find((p) => p.delivery)?.delivery?.status || null;

  const previousStatus = order.status;
  const wasDelivered = previousStatus === "DELIVERED";

  const mappedStatus = deliveryStatus
    ? mapDeliveryStatus(deliveryStatus)
    : mapBorzoStatus(borzoStatus);

  const nextStatus = transitionStatus(order.status, mappedStatus);

  order.status = nextStatus;

  if (nextStatus === "DELIVERED" && !order.deliveredAt) {
    order.deliveredAt = new Date();
  }

  // ===== COD Settlement Update =====
  if (order.cod?.enabled) {
    order.cod.collectedAmount = backpaymentAmount;
    order.cod.codFee = codFeeAmount;

    if (
      mappedStatus === "DELIVERED" &&
      backpaymentAmount > 0 &&
      !order.codSettled
    ) {
      await creditWallet({
        userId: order.user,

        amount: backpaymentAmount,

        reason: "COD_SETTLEMENT",

        category: "COD",

        description: `COD settlement for order ${order.borzoOrderId}`,

        order: order._id,

        reference: order.borzoOrderId,

        metadata: {
          provider: "BORZO",
          codFee: codFeeAmount,
        },

        performedBy: order.user,
      });

      order.codSettled = true;
    }
  }

  if (
    nextStatus &&
    (order.statusHistory.length === 0 ||
      order.statusHistory[order.statusHistory.length - 1].status !== nextStatus)
  ) {
    order.statusHistory.push({ status: nextStatus });
  }

  order.rawProviderResponse = response;

  const savedOrder = await order.save();

  if (previousStatus !== mappedStatus) {
    try {
      await createCustomerNotification({
        user: order.user,
        order: order._id,
        type: "ORDER_STATUS",
        title: "Order Update",
        message: `Your order #${order.borzoOrderId} is now ${mappedStatus.replace(
          /_/g,
          " ",
        )}`,
      });
    } catch (err) {
      console.error("Notification creation failed:", err.message);
    }
  }

  if (mappedStatus === "DELIVERED" && !wasDelivered) {
    notifyOrderDelivered(savedOrder).catch(() => {});
  }

  emitOrderUpdate(savedOrder.user, savedOrder, { admin: true });

  return savedOrder;
};

// CALCULATE PRICE

const calculateOrderService = async (data) => {
  data.package = data.package || {
    weight: data.weight || 0,
    declaredValue: data.declaredValue || 0,
  };

  data.vehicleTypeId = data.vehicleTypeId || data.vehicleType;

  const isEndOfDay =
    data.deliveryType === "EOD" || data.deliveryType === "END_OF_DAY";
  const vehicles = await getVehicleTypes();
  const validVehicle = isEndOfDay
    ? null
    : vehicles.find(
        (vehicle) => String(vehicle.id) === String(data.vehicleTypeId),
      );

  if (!isEndOfDay && !validVehicle) {
    const err = new Error("Invalid vehicle type");
    err.statusCode = 400;
    throw err;
  }

  if (
    !isEndOfDay &&
    validVehicle.maxWeightKg &&
    Number(data.package?.weight) > validVehicle.maxWeightKg
  ) {
    const err = new Error(
      `Weight ${data.package?.weight}kg exceeds ${validVehicle.name} limit of ${validVehicle.maxWeightKg}kg`,
    );
    err.statusCode = 400;
    throw err;
  }

  const payload = mapCalculatePayload(data);

  let response;

  try {
    response = await pulseService.calculateOrder(payload);
  } catch (err) {
    throwProviderError(err);
  }

  if (!response?.is_successful) {
    throwProviderError(response);
  }

  if (
    response?.order?.payment_amount === undefined ||
    response?.order?.payment_amount === null
  ) {
    throw new Error("Price calculation failed from provider");
  }
  const baseAmount = toMoneyNumber(response.order.payment_amount);
  const insuranceCharge = toMoneyNumber(response.order.insurance_fee_amount);
  // Get pricing config
  let pricingConfig = await AdminPricing.findOne({ isActive: true });

  if (!pricingConfig) {
    pricingConfig = {
      marginPercent: 0,
      baseFees: { platformFee: 0, handlingFee: 0 },
      surge: { enabled: false },
      vehicleOverrides: [],
    };
  }
  // Apply admin pricing
  let adjustedAmount = baseAmount;

  if (pricingConfig && baseAmount > 0) {
    adjustedAmount = applyAdminPricing({
      basePrice: baseAmount,
      config: pricingConfig,
      vehicleType: String(data.vehicleTypeId || data.vehicleType || ""),
    });
  }

  const amount = Number(adjustedAmount.toFixed(2));

  return {
    amount,
    currency: process.env.CURRENCY,
    providerAmount: baseAmount,
    insurance: insuranceCharge,
    deliveryFee: Number(Math.max(amount - insuranceCharge, 0).toFixed(2)),
    breakdown: {
      deliveryFeeAmount: toMoneyNumber(response.order.delivery_fee_amount),
      insuranceAmount: toMoneyNumber(response.order.insurance_amount),
      insuranceFeeAmount: insuranceCharge,
      weightFeeAmount: toMoneyNumber(response.order.weight_fee_amount),
      codFeeAmount: toMoneyNumber(response.order.cod_fee_amount),
      waitingFeeAmount: toMoneyNumber(response.order.waiting_fee_amount),
      promoDiscountAmount: toMoneyNumber(
        response.order.promo_code_discount_amount,
      ),
    },
  };
};

// EDIT ORDER

const editOrderService = async (id, userId, data) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) throw new Error("Order not found");

  const payload = mapEditPayload(order.borzoOrderId, data, order);
  // chatgpt change
  let response;

  try {
    response = await pulseService.editOrder(payload);
  } catch (err) {
    throwProviderError(err);
  }
  if (!response?.is_successful) {
    const mapped = mapProviderError(response);

    const err = new Error(mapped.message);
    err.statusCode = mapped.status;
    err.code = mapped.code;

    throw err;
  }

  const providerOrder =
    response?.order || response?.data?.order || response?.orders?.[0];
  if (providerOrder) {
    order.package.description = providerOrder.matter;
    order.package.weight = providerOrder.total_weight_kg;
    order.vehicleTypeId = providerOrder.vehicle_type_id;

    const points = providerOrder.points || [];

    const pickupPoint = points[0];
    const dropPoint = points[1];

    if (pickupPoint) {
      order.pickup = {
        address: pickupPoint.address,
        lat: pickupPoint.latitude ? Number(pickupPoint.latitude) : null,
        lng: pickupPoint.longitude ? Number(pickupPoint.longitude) : null,
        name: order.customer?.name || null,
        phone: order.customer?.phone || null,
      };
    }

    const existingReceiver = order.stops?.[1];

    if (dropPoint) {
      order.drop = {
        address: dropPoint.address,
        lat: dropPoint.latitude ? Number(dropPoint.latitude) : null,
        lng: dropPoint.longitude ? Number(dropPoint.longitude) : null,
        name: existingReceiver?.name || order.customer?.name || null,
        phone: existingReceiver?.phone || order.customer?.phone || null,
      };
    }

    order.stops = [
      {
        type: "PICKUP",
        address: order.pickup.address,
        lat: order.pickup.lat,
        lng: order.pickup.lng,
        name: order.customer?.name || null,
        phone: order.customer?.phone || null,
      },
      {
        type: "DROP",
        address: order.drop.address,
        lat: order.drop.lat,
        lng: order.drop.lng,
        name: existingReceiver?.name || order.customer?.name || null,
        phone: existingReceiver?.phone || order.customer?.phone || null,
      },
    ];
  }

  // ===== RE-CALCULATE PRICING AFTER EDIT =====
  try {
    const calculatePayload = mapCalculatePayload({
      matter: order.package.description,
      vehicleTypeId: order.vehicleTypeId,

      package: {
        weight: order.package?.weight || 0,
        declaredValue: order.package?.declaredValue || 0,
      },

      pickup: {
        address: order.pickup.address,
        lat: order.pickup.lat,
        lng: order.pickup.lng,
      },

      drop: {
        address: order.drop.address,
        lat: order.drop.lat,
        lng: order.drop.lng,
      },

      deliveryType: order.deliveryType,
    });

    const priceResponse = await pulseService.calculateOrder(calculatePayload);

    if (priceResponse?.order?.payment_amount) {
      const baseAmount = Number(
        Number(priceResponse.order.payment_amount || 0).toFixed(2),
      );

      let pricingConfig = await AdminPricing.findOne({ isActive: true });

      if (!pricingConfig) {
        pricingConfig = {
          marginPercent: 0,
          baseFees: { platformFee: 0, handlingFee: 0 },
          surge: { enabled: false },
          vehicleOverrides: [],
        };
      }

      let adjustedAmount = baseAmount;

      if (pricingConfig && baseAmount > 0) {
        adjustedAmount = applyAdminPricing({
          basePrice: baseAmount,
          config: pricingConfig,
          vehicleType: String(order.vehicleTypeId),
        });
      }

      const finalAmount = Number(adjustedAmount.toFixed(2));

      order.pricing = {
        baseAmount,
        adjustedAmount,
        insurance: Number(priceResponse.order.insurance_fee_amount || 0),
        amount: finalAmount,
        currency: process.env.CURRENCY,
        calculatedAt: new Date(),
      };

      order.pricingSnapshot = {
        basePrice: baseAmount,

        marginAmount: Number(
          (baseAmount * ((pricingConfig.marginPercent || 0) / 100)).toFixed(2),
        ),

        platformFeeAmount: Number(
          (pricingConfig.baseFees?.platformFee || 0).toFixed(2),
        ),

        handlingFeeAmount: Number(
          (pricingConfig.baseFees?.handlingFee || 0).toFixed(2),
        ),

        marginPercent: pricingConfig.marginPercent,

        platformFee: pricingConfig.baseFees?.platformFee || 0,
        handlingFee: pricingConfig.baseFees?.handlingFee || 0,

        surgeMultiplier: pricingConfig.surge?.multiplier || 1,
        surgeApplied: pricingConfig.surge?.enabled || false,

        vehicleType: String(order.vehicleTypeId),

        vehicleMultiplier:
          pricingConfig.vehicleOverrides?.find(
            (v) => String(v.type) === String(order.vehicleTypeId),
          )?.multiplier || 1,
        insurancePercent: null,

        insuranceFeeAmount: Number(
          priceResponse.order.insurance_fee_amount || 0,
        ),

        codFee: Number(priceResponse.order.cod_fee_amount || 0),

        finalPrice: finalAmount,
      };
    }
  } catch (err) {
    console.error("Pricing recalculation failed:", err.message);
  }

  order.rawProviderResponse = response;

  const savedOrder = await order.save();

  emitOrderUpdate(savedOrder.user, savedOrder);

  return savedOrder;
};

// PROVIDER ADMIN

const listProviderOrdersService = async (filters = {}) => {
  return pulseService.listProviderOrders(filters);
};

const getProviderOrderService = async (orderId) => {
  return pulseService.getProviderOrder(orderId);
};

// GET COURIER INFO

const getCourierInfoService = async (id, userId) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const response = await pulseService.getCourierInfo(order.borzoOrderId);

  if (!response?.is_successful) {
    const err = new Error("Failed to fetch courier info");
    err.statusCode = 400;
    throw err;
  }

  if (!response?.courier) return null;

  const courier = response.courier;

  //  DB mein bhi location save karo agar available hai
  if (
    courier.latitude !== undefined &&
    courier.latitude !== null &&
    courier.longitude !== undefined &&
    courier.longitude !== null
  ) {
    await Order.findByIdAndUpdate(id, {
      "courier.location.lat": Number(courier.latitude),
      "courier.location.lng": Number(courier.longitude),
      "courier.name": courier.name || null,
      "courier.surname": courier.surname || null,
      "courier.phone": courier.phone || null,
      "courier.photoUrl": courier.photo_url || null,
      "courier.courierId": courier.courier_id || null,
    });
  }

  return courier;
};

// GET PROVIDER CLIENT PROFILE

const getClientProfileService = async () => {
  const response = await pulseService.getClientProfile();

  if (!response?.is_successful) {
    const err = new Error("Failed to fetch client profile");
    err.statusCode = 400;
    throw err;
  }

  return response.client;
};

// GET PROVIDER BANK CARDS

const getBankCardsService = async () => {
  const response = await pulseService.getBankCards();

  if (!response?.is_successful) {
    const err = new Error("Failed to fetch bank cards");
    err.statusCode = 400;
    throw err;
  }

  return response.bank_cards || [];
};

// GET PROVIDER LABELS

const getLabelsService = async (filters) => {
  const response = await pulseService.getLabels(filters);

  if (!response?.is_successful) {
    const err = new Error("Failed to fetch labels");
    err.statusCode = 400;
    throw err;
  }

  return response.labels || [];
};

const getTrackingService = async (id, userId) => {
  let order;

  if (userId) {
    order = await Order.findOne({ _id: id, user: userId });
  } else {
    order = await Order.findById(id);
  }

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const borzoOrder = await fetchBorzoOrder(order.borzoOrderId);

  const url =
    borzoOrder.points?.find((p) => p.tracking_url)?.tracking_url || null;
  const courier = borzoOrder.courier || order.courier || null;

  const points =
    borzoOrder.points?.map((p) => ({
      latitude: p.latitude || null,
      longitude: p.longitude || null,
      delivery: !!p.delivery,
    })) || [];

  return {
    tracking_url: url,
    points,
    courier: courier
      ? {
          name: courier.name || null,
          surname: courier.surname || null,
          phone: courier.phone || null,
          photoUrl: courier.photo_url || courier.photoUrl || null,
          latitude:
            courier.latitude !== undefined && courier.latitude !== null
              ? Number(courier.latitude)
              : (courier.location?.lat ?? null),

          longitude:
            courier.longitude !== undefined && courier.longitude !== null
              ? Number(courier.longitude)
              : (courier.location?.lng ?? null),
        }
      : null,
  };
};

const getPODService = async (id, userId) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const borzoOrder = await fetchBorzoOrder(order.borzoOrderId);

  const podPoint = borzoOrder.points?.find(
    (p) => p.place_photo_url || p.sign_photo_url,
  );

  return {
    placePhotoUrl: podPoint?.place_photo_url || null,
    signPhotoUrl: podPoint?.sign_photo_url || null,
  };
};

const getDocumentsService = async (id, userId) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const borzoOrder = await fetchBorzoOrder(order.borzoOrderId);

  return {
    waybillUrl: borzoOrder.waybill_document_url || null,
    itineraryUrl: borzoOrder.itinerary_document_url || null,
  };
};

const getPricingBreakdownService = async (id, userId) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const borzoOrder = await fetchBorzoOrder(order.borzoOrderId);

  return {
    deliveryFeeAmount: borzoOrder.delivery_fee_amount || "0.00",
    codFeeAmount: borzoOrder.cod_fee_amount || "0.00",
    waitingFeeAmount: borzoOrder.waiting_fee_amount || "0.00",
    promoDiscount: borzoOrder.promo_code_discount_amount || "0.00",
    total: borzoOrder.payment_amount || "0.00",
  };
};

const getProviderHistoryService = async (id, userId) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const borzoOrder = await fetchBorzoOrder(order.borzoOrderId);

  return {
    orderId: borzoOrder.order_id,
    currentStatus: borzoOrder.status,
    points:
      borzoOrder.points?.map((p) => ({
        pointId: p.point_id,
        deliveryStatus: p.delivery?.status || null,
      })) || [],
  };
};

const createBulkOrdersService = async (orders, userId) => {
  const results = [];

  for (const payload of orders) {
    try {
      const created = await createOrderService({
        ...payload,
        user: userId,
      });

      results.push({
        success: true,
        orderId: created._id,
        borzoOrderId: created.borzoOrderId,
      });
    } catch (err) {
      results.push({
        success: false,
        error: err.message,
        payload,
      });
    }
  }

  return results;
};

const fetchBorzoOrder = async (borzoOrderId) => {
  const response = await pulseService.getTracking(borzoOrderId);
  if (!response?.is_successful || !response?.orders?.length) {
    throw new Error("Failed to fetch order from provider");
  }
  return response.orders[0];
};

module.exports = {
  createOrderService,
  getOrdersService,
  getOrderByIdService,
  getPublicTrackingOrderService,
  cancelOrderService,
  syncOrderService,
  calculateOrderService,
  editOrderService,
  listProviderOrdersService,
  getProviderOrderService,
  getCourierInfoService,
  getClientProfileService,
  getBankCardsService,
  getLabelsService,
  getTrackingService,
  getPODService,
  getDocumentsService,
  getPricingBreakdownService,
  getProviderHistoryService,
  createBulkOrdersService,
};
