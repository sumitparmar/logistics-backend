require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");
const PORT = process.env.PORT || 5000;

const http = require("http");
const { initSocket } = require("./config/socket");

// JOBS
const startReconciliationJob = require("./jobs/reconciliation.job");
const startProviderHealthJob = require("./providers/providerHealth.job");
const startOrderSyncJob = require("./jobs/orderSync.job");

// START SERVER FUNCTION
const startServer = async () => {
  await connectDB();

  //  Start Jobs AFTER DB is ready
  startReconciliationJob();
  startProviderHealthJob();
  startOrderSyncJob();
  require("./jobs/analytics.job");

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {});

  require("./workers/otp.worker");
};

startServer();
