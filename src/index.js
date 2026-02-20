require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const startReconciliationJob = require("./jobs/reconciliation.job");
const startProviderHealthJob = require("./providers/providerHealth.job");

const connectDB = require("./config/db");
const app = require("./app");

const PORT = process.env.PORT || 5000;

/* ---------------- DATABASE ---------------- */

connectDB();
startReconciliationJob();
startProviderHealthJob();

/* ---------------- START SERVER ---------------- */

const http = require("http");
const { initSocket } = require("./config/socket");

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
