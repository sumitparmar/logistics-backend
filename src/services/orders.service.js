const Order = require("../models/Order");
const { getIO } = require("../config/socket");
const pulseService = require("./pulse.service");
const { transitionStatus } = require("../engines/status.engine");
const { mapProviderError } = require("../utils/providerErrorMapper");
const { mapBorzoStatus } = require("../utils/statusMapper");
const {
  mapCreateOrderPayload,
  mapCalculatePayload,
  mapEditPayload,
} = require("../mappers/borzoOrder.mapper");
const { getVehicleTypes } = require("./providerCatalog.service");
const mongoose = require("mongoose");

// CREATE ORDER

const createOrderService = async (data) => {
  // Stops (new) or fallback to pickup/drop
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

  const amount = Number(priceResponse.order.payment_amount);
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
  const vehicleTypeFromProvider =
    createResponse.order.vehicle_type_id || validVehicle.id;
  const mappedStatus = mapBorzoStatus(providerStatus);

  const order = new Order({
    borzoOrderId: String(createResponse.order.order_id),

    customer: data.customer,
    pickup: data.pickup,
    drop: data.drop,

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
      amount,
      currency: process.env.CURRENCY,
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

  return savedOrder;
};

// LIST ORDERS

const getOrdersService = async (userId) => {
  return Order.find({ user: userId }).sort({ createdAt: -1 });
};

// GET SINGLE ORDER

const getOrderByIdService = async (id, userId) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid order id");
    err.statusCode = 400;
    throw err;
  }

  return Order.findOne({ _id: id, user: userId });
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

  return {
    amount: Number(response.order.payment_amount),
    currency: process.env.CURRENCY,
  };
};

// EDIT ORDER

const editOrderService = async (id, userId, data) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) throw new Error("Order not found");

  const payload = mapEditPayload(order.borzoOrderId, data);

  // chatgpt change
  const response = await pulseService.editOrder(payload);

  if (!response?.is_successful) {
    const mapped = mapProviderError(response);

    const err = new Error(mapped.message);
    err.statusCode = mapped.status;
    err.code = mapped.code;

    throw err;
  }

  // if (
  //   order.statusHistory.length === 0 ||
  //   order.statusHistory[order.statusHistory.length - 1].status !== "UPDATED"
  // ) {
  //   order.statusHistory.push({ status: "UPDATED" });
  // }

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
    const err = new Error("Failed to fetch tracking info");
    err.statusCode = 400;
    throw err;
  }

  const borzoOrder = response.orders[0];

  return {
    trackingUrl:
      borzoOrder.points?.find((p) => p.tracking_url)?.tracking_url || null,
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
