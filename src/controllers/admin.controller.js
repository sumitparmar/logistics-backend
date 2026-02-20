// const healthStore = require("../providers/providerHealth.store");
// const Reconciliation = require("../models/Reconciliation");
// const FailedJob = require("../models/FailedJob");
// const WebhookEvent = require("../models/WebhookEvent");

// // Provider health
// const getProviderHealth = async (req, res) => {
//   return res.json({
//     success: true,
//     data: healthStore.getAll(),
//   });
// };

// // Reconciliation mismatches
// const getReconciliationIssues = async (req, res) => {
//   const issues = await Reconciliation.find({ resolved: false }).limit(100);
//   res.json({ success: true, data: issues });
// };

// // Failed jobs
// const getFailedJobs = async (req, res) => {
//   const jobs = await FailedJob.find().sort({ createdAt: -1 }).limit(100);
//   res.json({ success: true, data: jobs });
// };

// // Webhook duplicates / failures
// const getWebhookFailures = async (req, res) => {
//   const hooks = await WebhookEvent.find().sort({ createdAt: -1 }).limit(100);

//   res.json({ success: true, data: hooks });
// };

// module.exports = {
//   getProviderHealth,
//   getReconciliationIssues,
//   getFailedJobs,
//   getWebhookFailures,
// };

const healthStore = require("../providers/providerHealth.store");
const Reconciliation = require("../models/Reconciliation");
const FailedJob = require("../models/failedJob.model");

// Provider health only (safe version)
const getProviderHealth = async (req, res) => {
  return res.json({
    success: true,
    data: healthStore.snapshot(),
  });
};

const getReconciliationIssues = async (req, res) => {
  const issues = await Reconciliation.find({ resolved: false })
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ success: true, data: issues });
};

const getFailedJobs = async (req, res) => {
  const jobs = await FailedJob.find().sort({ createdAt: -1 }).limit(100);

  res.json({ success: true, data: jobs });
};

const getWebhookFailures = async (req, res) => {
  return res.json({ success: true, data: [] });
};

module.exports = {
  getProviderHealth,
  getReconciliationIssues,
  getFailedJobs,
  getWebhookFailures,
};
