const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const { processDeliveredOrder, PDF_RENDER_VERSION } = require("../services/invoice.service");
const { enqueueInvoiceEmail } = require("../services/invoiceEmail.service");
const sendSuccess = require("../utils/response").sendSuccess;
const sanitizeInvoiceFilename = require("../utils/invoiceFilename");

const assertOrderId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error("Invalid order id");
    error.statusCode = 400;
    throw error;
  }
};

const getOwnedDeliveredOrder = async (orderId, userId) => {
  assertOrderId(orderId);
  const order = await Order.findOne({ _id: orderId, user: userId });
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

const getOrCreateInvoice = async (order) => {
  let invoice = await Invoice.findOne({ order: order._id });
  if (!invoice || !invoice.pdf?.checksum || invoice.pdf.templateVersion !== PDF_RENDER_VERSION) {
    await processDeliveredOrder(order);
    invoice = await Invoice.findOne({ order: order._id });
  }
  if (!invoice || !invoice.pdf?.checksum || invoice.pdf.templateVersion !== PDF_RENDER_VERSION) {
    const error = new Error("Invoice is being prepared with the latest template. Please try again shortly");
    error.statusCode = 503;
    throw error;
  }
  return invoice;
};

const toMetadata = (invoice) => ({
  _id: invoice._id,
  invoiceNumber: invoice.invoiceNumber,
  order: invoice.order,
  status: invoice.status,
  currency: invoice.currency,
  issueDate: invoice.issueDate || invoice.createdAt,
  deliveredDate: invoice.deliveredDate,
  bookingDate: invoice.bookingDate,
  subtotal: invoice.taxableSubtotal ?? invoice.subtotal,
  tax: invoice.tax,
  taxBreakdown: invoice.taxBreakdown || null,
  total: invoice.grandTotal ?? invoice.total,
  amountPaid: invoice.amountPaid,
  amountDue: invoice.amountDue,
  amountInWords: invoice.amountInWords,
  lineItems: invoice.lineItems,
  email: {
    status: invoice.email?.status || "PENDING",
    attempts: invoice.email?.attempts || 0,
    lastAttemptAt: invoice.email?.lastAttemptAt || null,
    sentAt: invoice.email?.sentAt || null,
    lastError: invoice.email?.lastError || null,
  },
  templateVersion: invoice.templateVersion,
});

const getInvoiceByOrder = async (req, res, next) => {
  try {
    const order = await getOwnedDeliveredOrder(req.params.orderId, req.user._id);
    const invoice = await getOrCreateInvoice(order);
    return sendSuccess(res, toMetadata(invoice), "Invoice fetched");
  } catch (error) {
    next(error);
  }
};

const downloadInvoice = async (req, res, next) => {
  try {
    const order = await getOwnedDeliveredOrder(req.params.orderId, req.user._id);
    const invoice = await getOrCreateInvoice(order);
    const storedInvoice = await Invoice.findOne({ _id: invoice._id, user: req.user._id }).select("+pdf.data");

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

const resendInvoiceEmail = async (req, res, next) => {
  try {
    const order = await getOwnedDeliveredOrder(req.params.orderId, req.user._id);
    const invoice = await getOrCreateInvoice(order);
    if (!invoice.customerSnapshot?.email) {
      const error = new Error("No verified customer email is available for this order");
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
  getInvoiceByOrder,
  downloadInvoice,
  resendInvoiceEmail,
  getOwnedDeliveredOrder,
  getOrCreateInvoice,
  toMetadata,
};
