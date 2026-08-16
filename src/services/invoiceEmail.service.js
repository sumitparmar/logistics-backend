const crypto = require("crypto");
const Invoice = require("../models/Invoice");
const invoiceQueue = require("../queues/invoice.queue");
const sendEmail = require("../utils/sendEmail");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const enqueueInvoiceEmail = async (invoiceId, { force = false } = {}) => {
  const invoice = await Invoice.findById(invoiceId).select("customerSnapshot email invoiceNumber");
  if (!invoice) return null;
  if (!invoice.customerSnapshot?.email) {
    await Invoice.findByIdAndUpdate(invoiceId, { $set: { "email.status": "NOT_AVAILABLE" } });
    return null;
  }
  if (!force && (invoice.email?.status === "SENT" || invoice.email?.status === "QUEUED")) return invoice;
  if (force && invoice.email?.status === "QUEUED") return invoice;

  const updated = await Invoice.findOneAndUpdate(
    { _id: invoiceId, "email.status": force ? { $ne: "QUEUED" } : { $nin: ["SENT", "QUEUED"] } },
    {
      $set: {
        "email.status": "QUEUED",
        "email.lastError": null,
      },
    },
    { new: true },
  );
  if (!updated) return Invoice.findById(invoiceId).select("customerSnapshot email invoiceNumber");

  await invoiceQueue.add(
    { invoiceId: String(invoiceId) },
    {
      attempts: 5,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: 100,
      removeOnFail: false,
    },
  );
  return updated;
};

const claimInvoiceEmail = async (invoiceId) => {
  const processingToken = crypto.randomUUID();
  const staleAt = new Date(Date.now() - 15 * 60 * 1000);
  const invoice = await Invoice.findOneAndUpdate(
    {
      _id: invoiceId,
      "email.status": { $in: ["PENDING", "QUEUED", "FAILED"] },
      $or: [
        { "email.processingAt": null },
        { "email.processingAt": { $lt: staleAt } },
      ],
    },
    {
      $set: {
        "email.status": "QUEUED",
        "email.processingToken": processingToken,
        "email.processingAt": new Date(),
        "email.lastAttemptAt": new Date(),
      },
      $inc: { "email.attempts": 1 },
    },
    { new: true },
  ).select("+email.processingToken +pdf.data");
  return { invoice, processingToken };
};

const sendInvoiceEmailById = async (invoiceId) => {
  const claim = await claimInvoiceEmail(invoiceId);
  if (!claim.invoice) return null;
  const invoice = claim.invoice;
  const tokenFilter = { _id: invoiceId, "email.processingToken": claim.processingToken };

  try {
    if (!invoice.pdf?.data) throw new Error("Invoice PDF is not available");
    const customer = invoice.customerSnapshot || {};
    const business = invoice.businessSnapshot || {};
    const orderReference = invoice.deliverySnapshot?.orderReference || invoice.order;
    const total = `${invoice.currency} ${Number(invoice.grandTotal || invoice.total || 0).toFixed(2)}`;
    const customerName = escapeHtml(customer.name || "Customer");
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2>${escapeHtml(business.legalName || "MoveKart Logistics")}</h2><p>Hello ${customerName},</p><p>Your delivery order <strong>${escapeHtml(orderReference)}</strong> was completed on ${escapeHtml(new Date(invoice.deliveredDate).toLocaleString("en-IN"))}.</p><p>Invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> is attached. Grand total: <strong>${escapeHtml(total)}</strong>.</p><p>Thank you for choosing MoveKart.</p><p>${escapeHtml(business.supportEmail || "")}${business.supportPhone ? ` | ${escapeHtml(business.supportPhone)}` : ""}</p></body></html>`;
    const text = `Hello ${customer.name || "Customer"}, your MoveKart delivery order ${orderReference} was completed. Invoice ${invoice.invoiceNumber} is attached. Grand total: ${total}.`;
    const info = await sendEmail(
      customer.email,
      `MoveKart invoice ${invoice.invoiceNumber}`,
      html,
      [
        {
          filename: invoice.pdf.filename || `MoveKart-Invoice-${invoice.invoiceNumber}.pdf`,
          content: invoice.pdf.data,
          contentType: "application/pdf",
        },
      ],
      text,
    );
    await Invoice.findOneAndUpdate(
      tokenFilter,
      {
        $set: {
          "email.status": "SENT",
          "email.sentAt": new Date(),
          "email.messageId": info?.messageId || null,
          "email.processingToken": null,
          "email.processingAt": null,
          "email.lastError": null,
        },
      },
    );
    return true;
  } catch (error) {
    await Invoice.findOneAndUpdate(
      tokenFilter,
      {
        $set: {
          "email.status": "FAILED",
          "email.lastError": String(error.message || "Email delivery failed").slice(0, 500),
          "email.processingToken": null,
          "email.processingAt": null,
        },
      },
    );
    throw error;
  }
};

module.exports = {
  enqueueInvoiceEmail,
  sendInvoiceEmailById,
};
