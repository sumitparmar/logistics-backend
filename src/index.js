require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const startReconciliationJob = require("./jobs/reconciliation.job");
const startProviderHealthJob = require("./providers/providerHealth.job");
const startOrderSyncJob = require("./jobs/orderSync.job");
const connectDB = require("./config/db");
const app = require("./app");
const PORT = process.env.PORT || 5000;

//  DATABASE

connectDB();
startReconciliationJob();
startProviderHealthJob();
startOrderSyncJob();

//  START SERVER

const http = require("http");
const { initSocket } = require("./config/socket");

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {});
require("./workers/otp.worker");
