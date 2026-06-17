const Invoice = require("../models/Invoice");
const generateInvoiceNumber = require("../utils/invoiceNumber");

const createInvoiceForOrder = async (order) => {
  const existing = await Invoice.findOne({ order: order._id });
  if (existing) return existing;

  const lineItems = [
    {
      label: "Delivery Charge",
      amount: order.pricing.amount,
    },
  ];

  if (order.cod?.enabled && order.cod.amount > 0) {
    lineItems.push({
      label: "COD Collected",
      amount: order.cod.amount,
    });
  }
  const subtotal = Number(order.pricing.amount);

  const invoice = await Invoice.create({
    invoiceNumber: generateInvoiceNumber(),
    order: order._id,
    user: order.user,
    currency: order.pricing.currency,
    lineItems,
    subtotal,
    tax: 0,
    total: subtotal,
  });

  return invoice;
};

module.exports = {
  createInvoiceForOrder,
};
