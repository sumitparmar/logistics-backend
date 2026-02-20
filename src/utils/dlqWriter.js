const FailedJob = require("../models/failedJob.model");

async function pushToDLQ({ type, payload, error, provider }) {
  try {
    await FailedJob.create({
      type,
      payload,
      error: error?.message || String(error),
      provider,
    });
  } catch (err) {
    console.error("DLQ WRITE FAILED:", err);
  }
}

module.exports = { pushToDLQ };
