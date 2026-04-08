const Order = require("../models/Order");
const { getIO } = require("../config/socket");
const pulseService = require("./pulse.service");
const { transitionStatus } = require("../engines/status.engine");
const { mapProviderError } = require("../utils/providerErrorMapper");
const { mapBorzoStatus } = require("../utils/statusMapper");

const AdminPricing = require("../models/adminPricing.model");
const { applyAdminPricing } = require("./adminPricing.service");

const {
  mapCreateOrderPayload,
  mapCalculatePayload,
  mapEditPayload,
} = require("../mappers/borzoOrder.mapper");
const { getVehicleTypes } = require("./providerCatalog.service");
const mongoose = require("mongoose");

// CREATE ORDER

const createOrderService = async (data) => {
  console.log("PACKAGE DATA:", data.package);
  console.log("DECLARED VALUE:", data);

  if (data.deliveryType === "SCHEDULED") {
    data.scheduledAt =
      data.scheduledAt || data.scheduleDateTime || data.schedule || null;

    console.log("SCHEDULE DEBUG:", {
      deliveryType: data.deliveryType,
      scheduledAt: data.scheduledAt,
    });

    if (!data.scheduledAt) {
      throw new Error("scheduledAt missing at service level");
    }
  }

  const stops = data.stops || [
    {
      type: "PICKUP",
      ...data.pickup,
      name: data.customer?.name,
      phone: data.customer?.phone,
    },
    {
      type: "DROP",
      ...data.drop,
      name: data.customer?.name,
      phone: data.customer?.phone,
    },
  ];

  // Delivery Type
  data.deliveryType = data.deliveryType || "NOW";

  // Package
  data.package = data.package || {
    weight: null,
    category: null,
    description: null,
    declaredValue: data.declaredValue || null,
  };

  // Payment
  data.payment = data.payment || {
    method: "CASH",
    feePayer: "DROP",
  };
  const vehicles = await getVehicleTypes();

  const validVehicle = vehicles.find(
    (v) => String(v.id) === String(data.vehicleTypeId),
  );

  if (!validVehicle) {
    const err = new Error("Invalid vehicle type");
    err.statusCode = 400;
    throw err;
  }

  data.vehicleTypeId = data.vehicleTypeId || data.vehicleType;
  const calculatePayload = mapCalculatePayload(data);
  const priceResponse = await pulseService.calculateOrder(calculatePayload);

  if (!priceResponse?.order?.payment_amount) {
    throw new Error("Price calculation failed");
  }

  const baseAmount = Number(
    Number(priceResponse.order.payment_amount || 0).toFixed(2),
  );

  const declaredValue = data.package?.declaredValue || 0;

  let insuranceCharge = 0;

  if (declaredValue > 0) {
    insuranceCharge = Math.round(2 + declaredValue * 0.01);
  }

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

  // Step 2: add insurance AFTER pricing
  const finalAmount = Number((adjustedAmount + insuranceCharge).toFixed(2));

  const snapshot = {
    basePrice: baseAmount,

    marginPercent: pricingConfig.marginPercent,

    platformFee: pricingConfig.baseFees?.platformFee || 0,
    handlingFee: pricingConfig.baseFees?.handlingFee || 0,

    surgeMultiplier: pricingConfig.surge?.multiplier || 1,
    surgeApplied: pricingConfig.surge?.enabled || false,

    vehicleType: String(data.vehicleTypeId),
    vehicleMultiplier:
      pricingConfig.vehicleOverrides?.find(
        (v) => v.type === String(data.vehicleTypeId),
      )?.multiplier || 1,

    insurancePercent: pricingConfig.extras?.insurancePercent || 0,
    codFee: pricingConfig.extras?.codFee || 0,

    finalPrice: finalAmount,
  };
  let createPayload;

  // END-OF-DAY FLOW
  if (data.orderType === "END_OF_DAY") {
    createPayload = {
      order_id: priceResponse.order.order_id,
    };
  } else {
    createPayload = mapCreateOrderPayload(data);
  }

  const createResponse = await pulseService.createOrder(createPayload);

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

    status: transitionStatus(null, mappedStatus),
    statusHistory: [{ status: transitionStatus(null, mappedStatus) }],

    provider: "BORZO",

    rawProviderResponse: createResponse,
  });

  const savedOrder = await order.save();

  const io = getIO();
  io.to(`user:${savedOrder.user}`).emit("order-status-update", {
    orderId: savedOrder._id,
    status: savedOrder.status,
  });

  io.to("admin").emit("admin-order-update", {
    orderId: savedOrder._id,
    data: savedOrder,
  });

  setTimeout(async () => {
    try {
      await syncOrderService(savedOrder._id);
      console.log("Auto-sync completed for:", savedOrder._id);
    } catch (err) {
      console.error("Auto-sync failed:", err.message);
    }
  }, 10000); // 10 sec delay

  return savedOrder;
};

// LIST ORDERS

// const getOrdersService = async (userId) => {
//   return Order.find({ user: userId }).sort({ createdAt: -1 });
// };

const getOrdersService = async (userId, query = {}) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);

  const skip = (page - 1) * limit;

  const filter = {};
  const isAdmin = String(query.isAdmin) === "true";

  if (!isAdmin) {
    filter.user = userId;
  }

  if (query.status) {
    if (query.status.includes(",")) {
      filter.status = { $in: query.status.split(",") };
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
    ];
  }

  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const [orders, total, active, delivered, cancelled] = await Promise.all([
    Order.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),

    Order.countDocuments(filter),
    Order.countDocuments({
      ...filter,
      status: { $in: ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
    }),

    Order.countDocuments({
      ...filter,
      status: "DELIVERED",
    }),
    Order.countDocuments({
      ...filter,
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
    order_id: order.borzoOrderId,
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

  if (
    order.statusHistory.length === 0 ||
    order.statusHistory[order.statusHistory.length - 1].status !== mappedStatus
  ) {
    order.statusHistory.push({ status: mappedStatus });
  }

  order.rawProviderResponse = response;

  const savedOrder = await order.save();

  const io = getIO();
  io.to(`user:${savedOrder.user}`).emit("order-status-update", {
    orderId: savedOrder._id,
    status: savedOrder.status,
  });

  return savedOrder;
};

// SYNC ORDER

const syncOrderService = async (id, userId) => {
  const order = await Order.findById(id);
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
    };
  }

  const backpaymentAmount = Number(borzoOrder.backpayment_amount || 0);
  const codFeeAmount = Number(borzoOrder.cod_fee_amount || 0);

  const borzoStatus = borzoOrder.status;

  const deliveryStatus =
    borzoOrder.points?.find((p) => p.delivery)?.delivery?.status || null;

  const mappedStatus = mapBorzoStatus(deliveryStatus || borzoStatus);

  order.status = transitionStatus(order.status, mappedStatus);
  // ===== COD Settlement Update =====
  if (order.cod?.enabled) {
    order.cod.collectedAmount = backpaymentAmount;
    order.cod.codFee = codFeeAmount;

    if (mappedStatus === "DELIVERED" && backpaymentAmount > 0) {
      order.codSettled = true;
    }
  }

  if (
    order.statusHistory.length === 0 ||
    order.statusHistory[order.statusHistory.length - 1].status !== mappedStatus
  ) {
    order.statusHistory.push({ status: mappedStatus });
  }

  order.rawProviderResponse = response;

  const savedOrder = await order.save();
  const io = getIO();

  io.to("admin").emit("admin-order-update", {
    orderId: savedOrder._id,
    data: savedOrder,
  });

  io.to(`user:${savedOrder.user}`).emit("order-status-update", {
    orderId: savedOrder._id,
    status: savedOrder.status,
  });

  return savedOrder;
};

// CALCULATE PRICE

const calculateOrderService = async (data) => {
  const payload = mapCalculatePayload(data);

  const response = await pulseService.calculateOrder(payload);

  const baseAmount = Number(response.order.payment_amount || 0);

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

  return {
    amount: adjustedAmount,
    currency: process.env.CURRENCY,
  };
};

// EDIT ORDER

const editOrderService = async (id, userId, data) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) throw new Error("Order not found");

  const payload = mapEditPayload(order.borzoOrderId, data, order);
  // chatgpt change
  const response = await pulseService.editOrder(payload);

  if (!response?.is_successful) {
    const mapped = mapProviderError(response);

    const err = new Error(mapped.message);
    err.statusCode = mapped.status;
    err.code = mapped.code;

    throw err;
  }

  const providerOrder = response?.order || response?.data?.order;

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
      };
    }

    if (dropPoint) {
      order.drop = {
        address: dropPoint.address,
        lat: dropPoint.latitude ? Number(dropPoint.latitude) : null,
        lng: dropPoint.longitude ? Number(dropPoint.longitude) : null,
      };
    }
  }
  order.rawProviderResponse = response;

  const savedOrder = await order.save();

  const io = getIO();
  io.to(`user:${savedOrder.user}`).emit("order-status-update", {
    orderId: savedOrder._id,
    status: savedOrder.status,
  });

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

  return response?.courier || null;
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

  const response = await pulseService.getTracking(order.borzoOrderId);

  if (!response?.is_successful || !response?.orders?.length) {
    return { tracking_url: null };
  }

  const borzoOrder = response.orders[0];

  const url =
    borzoOrder.points?.find((p) => p.tracking_url)?.tracking_url || null;

  const points =
    borzoOrder.points?.map((p) => ({
      latitude: p.latitude || null,
      longitude: p.longitude || null,
      delivery: !!p.delivery,
    })) || [];

  return {
    tracking_url: url,
    points,
  };
};

const getPODService = async (id, userId) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const response = await pulseService.getTracking(order.borzoOrderId);

  if (
    !response?.is_successful ||
    !response?.orders ||
    response.orders.length === 0
  ) {
    const err = new Error("Failed to fetch POD");
    err.statusCode = 400;
    throw err;
  }

  const borzoOrder = response.orders[0];

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

  const response = await pulseService.getTracking(order.borzoOrderId);

  if (
    !response?.is_successful ||
    !response?.orders ||
    response.orders.length === 0
  ) {
    const err = new Error("Failed to fetch documents");
    err.statusCode = 400;
    throw err;
  }

  const borzoOrder = response.orders[0];

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

  const response = await pulseService.getTracking(order.borzoOrderId);

  if (
    !response?.is_successful ||
    !response?.orders ||
    response.orders.length === 0
  ) {
    const err = new Error("Failed to fetch pricing breakdown");
    err.statusCode = 400;
    throw err;
  }

  const borzoOrder = response.orders[0];

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

  const response = await pulseService.getTracking(order.borzoOrderId);

  if (
    !response?.is_successful ||
    !response?.orders ||
    response.orders.length === 0
  ) {
    const err = new Error("Failed to fetch provider history");
    err.statusCode = 400;
    throw err;
  }

  const borzoOrder = response.orders[0];

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

module.exports = {
  createOrderService,
  getOrdersService,
  getOrderByIdService,
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
