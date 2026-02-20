const {
  createOrderService,
  getOrdersService,
  getOrderByIdService,
  cancelOrderService,
  syncOrderService,
  editOrderService,
  calculateOrderService,
  listProviderOrdersService,
  getProviderOrderService,
  getCourierInfoService,
  getClientProfileService,
  getBankCardsService,
} = require("../services/orders.service");

const pulseService = require("../services/pulse.service");
const { sendSuccess, sendError } = require("../utils/response");

// ============================
// CREATE ORDER
// ============================

const createOrder = async (req, res, next) => {
  try {
    if (!req.body.customer || !req.body.pickup || !req.body.drop) {
      return sendError(res, "Missing required order data", 400);
    }

    const order = await createOrderService({
      ...req.body,
      user: req.user._id,
    });

    return sendSuccess(res, order, "Order created", 201);
  } catch (error) {
    next(error);
  }
};

// ============================
// GET ALL ORDERS
// ============================

const getOrders = async (req, res, next) => {
  try {
    const orders = await getOrdersService(req.user._id);
    return sendSuccess(res, orders, "Orders fetched");
  } catch (error) {
    next(error);
  }
};

// ============================
// GET ORDER BY ID
// ============================

const getOrderById = async (req, res, next) => {
  try {
    const order = await getOrderByIdService(req.params.id, req.user._id);

    if (!order) {
      return sendError(res, "Order not found", 404);
    }

    return sendSuccess(res, order, "Order fetched");
  } catch (error) {
    next(error);
  }
};

// ============================
// CANCEL ORDER
// ============================

const cancelOrder = async (req, res, next) => {
  try {
    const order = await cancelOrderService(req.params.id, req.user._id);
    return sendSuccess(res, order, "Order cancelled");
  } catch (error) {
    next(error);
  }
};

// ============================
// SYNC ORDER WITH PROVIDER
// ============================

const syncOrder = async (req, res, next) => {
  try {
    const order = await syncOrderService(req.params.id, req.user._id);

    if (!order) {
      return sendError(res, "Order not found", 404);
    }

    return sendSuccess(res, order, "Order synced");
  } catch (error) {
    next(error);
  }
};

// ============================
// CALCULATE PRICE  ✅ FIXED
// ============================

const calculateOrder = async (req, res, next) => {
  try {
    const data = await calculateOrderService(req.body);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// ============================
// EDIT ORDER
// ============================

const editOrder = async (req, res, next) => {
  try {
    const order = await editOrderService(req.params.id, req.user._id, req.body);
    return sendSuccess(res, order, "Order updated");
  } catch (error) {
    next(error);
  }
};

// ============================
// LIST PROVIDER ORDERS
// ============================

const listProviderOrders = async (req, res, next) => {
  try {
    const orders = await listProviderOrdersService(req.query);
    return sendSuccess(res, orders, "Provider orders fetched");
  } catch (error) {
    next(error);
  }
};

// ============================
// GET PROVIDER ORDER
// ============================

const getProviderOrder = async (req, res, next) => {
  try {
    const order = await getProviderOrderService(req.params.orderId);

    if (!order) {
      return sendError(res, "Order not found", 404);
    }

    return sendSuccess(res, order, "Provider order fetched");
  } catch (error) {
    next(error);
  }
};

// GET COURIER INFO

const getCourierInfo = async (req, res, next) => {
  try {
    const courier = await getCourierInfoService(req.params.id, req.user._id);

    return sendSuccess(res, courier, "Courier info fetched");
  } catch (error) {
    next(error);
  }
};

// GET PROVIDER CLIENT PROFILE

const getClientProfile = async (req, res, next) => {
  try {
    const profile = await getClientProfileService();
    return sendSuccess(res, profile, "Client profile fetched");
  } catch (error) {
    next(error);
  }
};

// ============================
// GET PROVIDER BANK CARDS
// ============================

const getBankCards = async (req, res, next) => {
  try {
    const cards = await getBankCardsService();
    return sendSuccess(res, cards, "Bank cards fetched");
  } catch (error) {
    next(error);
  }
};

// EXPORTS

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  syncOrder,
  calculateOrder,
  editOrder,
  listProviderOrders,
  getProviderOrder,
  getCourierInfo,
  getClientProfile,
  getBankCards,
};
