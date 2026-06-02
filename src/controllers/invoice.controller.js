const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const { createInvoiceForOrder } = require("../services/invoice.service");
const { sendSuccess } = require("../utils/response");

const getInvoiceByOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    let invoice = await Invoice.findOne({
      order: orderId,
      user: req.user._id,
    });

    if (!invoice) {
      const order = await Order.findOne({
        _id: orderId,
        user: req.user._id,
        status: "DELIVERED",
      });

      if (order) {
        invoice = await createInvoiceForOrder(order);
      }
    }

    return sendSuccess(res, invoice, "Invoice fetched");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getInvoiceByOrder,
};
