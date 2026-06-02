const axios = require("axios");
const logger = require("../utils/logger");

const sendSms = async (phone, message) => {
  if (!phone || !message) {
    throw new Error("Phone and message are required");
  }

  if (String(process.env.SMS_ENABLED || "false") !== "true") {
    logger.info("SMS skipped because SMS_ENABLED is not true", { phone });
    return { skipped: true };
  }

  const endpoint = process.env.SMS_PROVIDER_URL;

  if (!endpoint) {
    throw new Error("SMS_PROVIDER_URL is required when SMS_ENABLED=true");
  }

  const authHeader = process.env.SMS_PROVIDER_AUTH_HEADER || "Authorization";
  const authToken = process.env.SMS_PROVIDER_AUTH_TOKEN;
  const sender = process.env.SMS_SENDER_ID || "MoveKart";

  const headers = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers[authHeader] = authToken;
  }

  const response = await axios.post(
    endpoint,
    {
      to: phone,
      message,
      sender,
    },
    {
      headers,
      timeout: Number(process.env.SMS_TIMEOUT_MS) || 10000,
    },
  );

  return response.data;
};

const sendSmsSafely = async (phone, message, metadata = {}) => {
  try {
    return await sendSms(phone, message);
  } catch (error) {
    logger.error("SMS delivery failed", {
      phone,
      metadata,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    return { failed: true, error: error.message };
  }
};

module.exports = { sendSms, sendSmsSafely };
