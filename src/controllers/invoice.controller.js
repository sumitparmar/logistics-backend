const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const { createInvoiceForOrder } = require("../services/invoice.service");
const { sendSuccess } = require("../utils/response");
const User = require("../models/User");
const generateInvoicePdf = require("../utils/generateInvoicePdf");
const sendEmail = require("../utils/sendEmail");
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

const downloadInvoice = async (req, res, next) => {
  const { orderId } = req.params;

  try {
    const { orderId } = req.params;

    const invoice = await Invoice.findOne({
      order: orderId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const order = await Order.findById(orderId);

    console.log("================ ORDER DATA ================");
    console.log(JSON.stringify(order, null, 2));
    console.log("===========================================");

    const user = await User.findById(req.user._id);

    const pdfBuffer = await generateInvoicePdf(invoice, order, user);

    await sendEmail(
      user.email,
      `Invoice ${invoice.invoiceNumber}`,
      `
    <h2>MoveKart Invoice</h2>
    <p>Hello ${user.name || "Customer"},</p>
    <p>Your invoice is attached with this email.</p>
    <p>Invoice Number: ${invoice.invoiceNumber}</p>
    <p>Thank you for choosing MoveKart.</p>
  `,
      [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    );

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${invoice.invoiceNumber}.pdf`,
    );

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getInvoiceByOrder,
  downloadInvoice,
};
