const cron = require("node-cron");
const Order = require("../models/Order");
const Invoice = require("../models/Invoice");
const { processDeliveredOrder } = require("../services/invoice.service");

const startInvoiceRecoveryJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const orders = await Order.find({ status: "DELIVERED" })
        .sort({ deliveredAt: 1 })
        .limit(100);

      for (const order of orders) {
        const invoice = await Invoice.findOne({ order: order._id });
        const emailNeedsRecovery =
          invoice &&
          ["PENDING", "FAILED"].includes(invoice.email?.status) &&
          (!invoice.email?.lastAttemptAt ||
            invoice.email.lastAttemptAt.getTime() < Date.now() - 5 * 60 * 1000);

        if (!invoice || !invoice.pdf?.checksum || emailNeedsRecovery) {
          await processDeliveredOrder(order);
        }
      }
    } catch (error) {
      console.error("INVOICE RECOVERY JOB ERROR:", error.message);
    }
  });
};

module.exports = startInvoiceRecoveryJob;
