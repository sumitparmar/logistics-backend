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

const mongoose = require("mongoose");

// ============================
// CREATE ORDER
// ============================

const createOrderService = async (data) => {
  const payload = mapCreateOrderPayload(data);

  const priceResponse = await pulseService.calculateOrder(payload);

  if (!priceResponse?.order?.payment_amount) {
    throw new Error("Price calculation failed");
  }

  const amount = Number(priceResponse.order.payment_amount);

  const createResponse = await pulseService.createOrder(payload);

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
  const mappedStatus = mapBorzoStatus(providerStatus);

  const order = new Order({
    user: data.user,

    borzoOrderId: String(createResponse.order.order_id),

    customer: data.customer,
    pickup: data.pickup,
    drop: data.drop,

    pricing: {
      amount,
      currency: process.env.CURRENCY,
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

  // 🔒 HARD BUSINESS RULE
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
  const order = await Order.findOne({ _id: id, user: userId });

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

  const courierData = borzoOrder.courier;

  const borzoStatus = borzoOrder.status;

  const deliveryStatus =
    borzoOrder.points?.find((p) => p.delivery)?.delivery?.status || null;

  const mappedStatus = mapBorzoStatus(deliveryStatus || borzoStatus);

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

// ============================
// CALCULATE PRICE
// ============================

const calculateOrderService = async (data) => {
  const payload = mapCalculatePayload(data);

  console.log("BORZO CALCULATE PAYLOAD:", JSON.stringify(payload, null, 2));

  const response = await pulseService.calculateOrder(payload);
  console.log("BORZO CALCULATE RAW:", JSON.stringify(response, null, 2));

  return {
    amount: Number(response.order.payment_amount),
    currency: process.env.CURRENCY,
  };
};

// ============================
// EDIT ORDER
// ============================

const editOrderService = async (id, userId, data) => {
  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) throw new Error("Order not found");

  const payload = mapEditPayload(order.borzoOrderId, data);

  const response = await pulseService.editOrder(payload);

  if (!response?.is_successful) {
    const mapped = mapProviderError(response);

    const err = new Error(mapped.message);
    err.statusCode = mapped.status;
    err.code = mapped.code;

    throw err;
  }

  if (
    order.statusHistory.length === 0 ||
    order.statusHistory[order.statusHistory.length - 1].status !== "UPDATED"
  ) {
    order.statusHistory.push({ status: "UPDATED" });
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

// ============================
// PROVIDER ADMIN
// ============================

const listProviderOrdersService = async (filters = {}) => {
  return pulseService.listProviderOrders(filters);
};

const getProviderOrderService = async (orderId) => {
  return pulseService.getProviderOrder(orderId);
};

// ============================
// GET COURIER INFO
// ============================

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

  return response.courier || null;
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

// ============================
// GET PROVIDER BANK CARDS
// ============================

const getBankCardsService = async () => {
  const response = await pulseService.getBankCards();

  if (!response?.is_successful) {
    const err = new Error("Failed to fetch bank cards");
    err.statusCode = 400;
    throw err;
  }

  return response.bank_cards || [];
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
};
