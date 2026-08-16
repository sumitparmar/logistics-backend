const {
  createOrderService,
  getOrdersService,
  getOrderByIdService,
  getPublicTrackingOrderService,
  cancelOrderService,
  syncOrderService,
  editOrderService,
  calculateOrderService,
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
} = require("../services/orders.service");
const { sendSuccess, sendError } = require("../utils/response");
const IdempotencyRecord = require("../models/IdempotencyRecord");
const Order = require("../models/Order");
const { logAction } = require("../utils/audit");
const crypto = require("crypto");

const readIdempotencyKey = (req) => {
  const key = req.get("Idempotency-Key") || req.body?.idempotencyKey;
  if (!key) return null;

  const normalized = String(key).trim();
  if (normalized.length < 8 || normalized.length > 128) {
    const err = new Error("Idempotency-Key must be between 8 and 128 characters");
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const reserveCreateOrder = async (userId, key, requestHash) => {
  if (!key) return { key: null, record: null };

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const record = await IdempotencyRecord.create({
      user: userId,
      operation: "CREATE_ORDER",
      key,
      requestHash,
      status: "PENDING",
      expiresAt,
    });
    return { key, record, replay: null };
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const existing = await IdempotencyRecord.findOne({
      user: userId,
      operation: "CREATE_ORDER",
      key,
    });

    if (existing?.requestHash && existing.requestHash !== requestHash) {
      const err = new Error("Idempotency-Key was already used for another request");
      err.statusCode = 422;
      throw err;
    }

    if (existing?.status === "SUCCEEDED" && existing.resource) {
      const order = await Order.findOne({
        _id: existing.resource,
        user: userId,
      });
      if (order) return { key, record: existing, replay: order };
    }

    if (existing?.status === "PENDING") {
      const err = new Error("A request with this Idempotency-Key is already processing");
      err.statusCode = 409;
      throw err;
    }

    const record = await IdempotencyRecord.findOneAndUpdate(
      { _id: existing?._id, status: "FAILED" },
      {
        $set: { status: "PENDING", expiresAt, requestHash },
        $unset: { resource: 1 },
      },
      { new: true },
    );

    if (!record) {
      const err = new Error("A request with this Idempotency-Key is already processing");
      err.statusCode = 409;
      throw err;
    }

    return { key, record, replay: null };
  }
};

// CREATE ORDER

const createOrder = async (req, res, next) => {
  let reservation = null;
  try {
    const idempotencyKey = readIdempotencyKey(req);
    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(req.body || {}))
      .digest("hex");
    reservation = await reserveCreateOrder(
      req.user._id,
      idempotencyKey,
      requestHash,
    );

    if (reservation.replay) {
      return sendSuccess(res, reservation.replay, "Order already created", 200);
    }

    const { customer, pickup, drop, matter, deliveryType, payment } = req.body;

    if (!customer || !pickup || !drop) {
      return sendError(res, "Missing required order data", 400);
    }

    if (!matter) {
      return sendError(res, "Package details are required", 400);
    }

    if (
      deliveryType &&
      !["NOW", "EOD", "END_OF_DAY", "SCHEDULED"].includes(deliveryType)
    ) {
      return sendError(res, "Invalid delivery type", 400);
    }

    if (
      payment?.method &&
      !["CASH", "BANK_CARD", "CARD", "WALLET", "BALANCE"].includes(
        payment.method,
      )
    ) {
      return sendError(res, "Invalid payment method", 400);
    }

    const order = await createOrderService({
      ...req.body,
      user: req.user._id,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });

    if (reservation.record) {
      await IdempotencyRecord.findOneAndUpdate(
        { _id: reservation.record._id, status: "PENDING" },
        { $set: { status: "SUCCEEDED", resource: order._id } },
      );
    }

    await logAction({
      user: req.user._id,
      action: "ORDER_CREATED",
      req,
      meta: {
        orderId: order._id,
        borzoOrderId: order.borzoOrderId,
        provider: order.provider,
        idempotencyKey: reservation.key || null,
      },
    });

    return sendSuccess(res, order, "Order created", 201);
  } catch (error) {
    if (reservation?.record) {
      await IdempotencyRecord.findOneAndUpdate(
        { _id: reservation.record._id, status: "PENDING" },
        { $set: { status: "FAILED" } },
      ).catch(() => {});
    }
    return sendError(
      res,
      error.message || "Unable to create order at this time",
      error.statusCode || 400,
    );
  }
};

const getOrders = async (req, res, next) => {
  try {
    const result = await getOrdersService(req.user._id, req.query);

    return res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

// GET ORDER BY ID

const getOrderById = async (req, res, next) => {
  try {
    const order = await getOrderByIdService(
      req.params.id,
      req.user ? req.user._id : null,
    );
    if (!order) {
      return sendError(res, "Order not found", 404);
    }

    return sendSuccess(res, order, "Order fetched");
  } catch (error) {
    next(error);
  }
};

const getPublicTrackingOrder = async (req, res, next) => {
  try {
    const order = await getPublicTrackingOrderService(req.params.id);
    return sendSuccess(res, order, "Tracking order fetched");
  } catch (error) {
    next(error);
  }
};

// CANCEL ORDER

const cancelOrder = async (req, res, next) => {
  try {
    const order = await cancelOrderService(req.params.id, req.user._id);
    await logAction({
      user: req.user._id,
      action: "ORDER_CANCELLED",
      req,
      meta: { orderId: order?._id || req.params.id },
    });
    return sendSuccess(res, order, "Order cancelled");
  } catch (error) {
    next(error);
  }
};

// SYNC ORDER WITH PROVIDER

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

// CALCULATE PRICE

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

// EDIT ORDER

const editOrder = async (req, res, next) => {
  try {
    const order = await editOrderService(req.params.id, req.user._id, req.body);
    await logAction({
      user: req.user._id,
      action: "ORDER_EDITED",
      req,
      meta: { orderId: order?._id || req.params.id },
    });
    return sendSuccess(res, order, "Order updated");
  } catch (error) {
    next(error);
  }
};

// LIST PROVIDER ORDERS

const listProviderOrders = async (req, res, next) => {
  try {
    const orders = await listProviderOrdersService(req.query);
    return sendSuccess(res, orders, "Provider orders fetched");
  } catch (error) {
    next(error);
  }
};

// GET PROVIDER ORDER

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

// GET PROVIDER BANK CARDS

const getBankCards = async (req, res, next) => {
  try {
    const cards = await getBankCardsService();
    return sendSuccess(res, cards, "Bank cards fetched");
  } catch (error) {
    next(error);
  }
};

// GET PROVIDER LABELS

const getLabels = async (req, res, next) => {
  try {
    const labels = await getLabelsService(req.query);
    return sendSuccess(res, labels, "Labels fetched");
  } catch (error) {
    next(error);
  }
};

const getTracking = async (req, res, next) => {
  try {
    const data = await getTrackingService(
      req.params.id,
      req.user ? req.user._id : null,
    );
    return sendSuccess(res, data, "Tracking URL fetched");
  } catch (error) {
    next(error);
  }
};

const getPOD = async (req, res, next) => {
  try {
    const data = await getPODService(req.params.id, req.user._id);
    return sendSuccess(res, data, "POD fetched");
  } catch (error) {
    next(error);
  }
};

const getDocuments = async (req, res, next) => {
  try {
    const data = await getDocumentsService(req.params.id, req.user._id);
    return sendSuccess(res, data, "Documents fetched");
  } catch (error) {
    next(error);
  }
};

const getPricingBreakdown = async (req, res, next) => {
  try {
    const data = await getPricingBreakdownService(req.params.id, req.user._id);
    return sendSuccess(res, data, "Pricing breakdown fetched");
  } catch (error) {
    next(error);
  }
};

const getProviderHistory = async (req, res, next) => {
  try {
    const data = await getProviderHistoryService(req.params.id, req.user._id);
    return sendSuccess(res, data, "Provider history fetched");
  } catch (error) {
    next(error);
  }
};

const createBulkOrders = async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.orders)) {
      return sendError(res, "orders must be an array", 400);
    }

    const results = await createBulkOrdersService(
      req.body.orders,
      req.user._id,
    );

    return sendSuccess(res, results, "Bulk orders processed");
  } catch (err) {
    next(err);
  }
};

// EXPORTS
module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  getPublicTrackingOrder,
  cancelOrder,
  syncOrder,
  calculateOrder,
  editOrder,
  listProviderOrders,
  getProviderOrder,
  getCourierInfo,
  getClientProfile,
  getBankCards,
  getLabels,
  getTracking,
  getPOD,
  getDocuments,
  getPricingBreakdown,
  getProviderHistory,
  createBulkOrders,
};
