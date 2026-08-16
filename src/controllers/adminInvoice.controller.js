const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const { processDeliveredOrder } = require("../services/invoice.service");
const { enqueueInvoiceEmail } = require("../services/invoiceEmail.service");
const { sendSuccess } = require("../utils/response");
const sanitizeInvoiceFilename = require("../utils/invoiceFilename");
const { getOrCreateInvoice, toMetadata } = require("./invoice.controller");

const getAdminDeliveredOrder = async (orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    const error = new Error("Invalid order id");
    error.statusCode = 400;
    throw error;
  }
  const order = await Order.findById(orderId);
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }
  if (order.status !== "DELIVERED") {
    const error = new Error("Invoice is available only after delivery");
    error.statusCode = 409;
    throw error;
  }
  return order;
};

const getAdminInvoice = async (req, res, next) => {
  try {
    const order = await getAdminDeliveredOrder(req.params.orderId);
    const invoice = await getOrCreateInvoice(order);
    return sendSuccess(res, toMetadata(invoice), "Invoice fetched");
  } catch (error) {
    next(error);
  }
};

const downloadAdminInvoice = async (req, res, next) => {
  try {
    const order = await getAdminDeliveredOrder(req.params.orderId);
    const invoice = await getOrCreateInvoice(order);
    const storedInvoice = await Invoice.findById(invoice._id).select("+pdf.data");
    if (!storedInvoice?.pdf?.data) {
      const error = new Error("Invoice PDF is being prepared. Please try again shortly");
      error.statusCode = 503;
      throw error;
    }
    res.setHeader("Content-Type", storedInvoice.pdf.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${sanitizeInvoiceFilename(storedInvoice.invoiceNumber)}\"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Length", String(storedInvoice.pdf.data.length));
    return res.send(storedInvoice.pdf.data);
  } catch (error) {
    next(error);
  }
};

const resendAdminInvoice = async (req, res, next) => {
  try {
    const order = await getAdminDeliveredOrder(req.params.orderId);
    const invoice = await getOrCreateInvoice(order);
    if (!invoice.customerSnapshot?.email) {
      const error = new Error("No customer email is available for this order");
      error.statusCode = 422;
      throw error;
    }
    await enqueueInvoiceEmail(invoice._id, { force: true });
    const updated = await Invoice.findById(invoice._id);
    return sendSuccess(res, toMetadata(updated), "Invoice email queued");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminInvoice,
  downloadAdminInvoice,
  resendAdminInvoice,
};
