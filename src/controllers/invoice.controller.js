const Invoice = require("../models/Invoice");
const { sendSuccess } = require("../utils/response");

const getInvoiceByOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const invoice = await Invoice.findOne({
      order: orderId,
      user: req.user._id,
    });

    return sendSuccess(res, invoice, "Invoice fetched");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getInvoiceByOrder,
};
