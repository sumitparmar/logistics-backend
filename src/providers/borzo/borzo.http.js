const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const CircuitBreaker = require("opossum");
const env = require("../../config/env");
const logger = require("../../utils/logger");

const axiosClient = axios.create({
  baseURL: env.BORZO.BASE_URL,
  timeout: 15000,
  headers: {
    "X-DV-Auth-Token": env.BORZO.API_TOKEN,
    "Content-Type": "application/json",
  },
});

/* ---------------- RETRY ---------------- */

axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    axiosRetry.isRetryableError(error) ||
    error.response?.status >= 500,
});

// CIRCUIT BREAKER

const breakerOptions = {
  timeout: 20000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const breaker = new CircuitBreaker(
  (config) => axiosClient(config),
  breakerOptions,
);

breaker.on("open", () => logger.error("BORZO CIRCUIT OPEN"));
breaker.on("halfOpen", () => logger.warn("BORZO CIRCUIT HALF-OPEN"));
breaker.on("close", () => logger.info("BORZO CIRCUIT CLOSED"));

// REQUEST WRAPPER

const client = async (config) => {
  logger.info("BORZO REQUEST", {
    method: config.method,
    url: config.url,
    data: config.data,
  });

  try {
    const response = await breaker.fire(config);

    logger.info("BORZO RESPONSE", {
      url: config.url,
      status: response.status,
    });

    return response.data;
  } catch (error) {
    logger.error("BORZO ERROR", {
      status: error.response?.status,
      data: error.response?.data,
    });

    throw error;
  }
};
//  HTTP METHODS

client.get = (url, options = {}) => client({ method: "get", url, ...options });

client.post = (url, data, options = {}) =>
  client({ method: "post", url, data, ...options });

module.exports = client;
