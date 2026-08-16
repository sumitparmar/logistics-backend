const invoiceQueue = require("../queues/invoice.queue");
const { sendInvoiceEmailById } = require("../services/invoiceEmail.service");

invoiceQueue.process(3, async (job) => {
  await sendInvoiceEmailById(job.data.invoiceId);
  return true;
});

invoiceQueue.on("failed", (job, error) => {
  console.error(`[INVOICE QUEUE] Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`);
});

invoiceQueue.on("error", (error) => {
  console.error("[INVOICE QUEUE] Redis/Bull error:", error.message);
});
