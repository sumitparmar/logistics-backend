const cron = require("node-cron");
const { reconcileOrders } = require("../services/reconciliation.service");

const startReconciliationJob = () => {
  cron.schedule("0 */6 * * *", async () => {
    console.log("Running reconciliation job...");
    await reconcileOrders();
  });
};

module.exports = startReconciliationJob;
