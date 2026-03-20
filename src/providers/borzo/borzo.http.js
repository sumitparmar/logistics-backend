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

  // headers: {
  //   Authorization: `Bearer ${env.BORZO.API_TOKEN}`,
  //   "Content-Type": "application/json",
  // },
});

axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    if (axiosRetry.isNetworkError(error)) return true;

    const status = error.response?.status;

    return status >= 500;
  },
});

const breakerOptions = {
  timeout: 20000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const breaker = new CircuitBreaker(
  async (config) => {
    const response = await axiosClient(config);
    return response;
  },
  {
    ...breakerOptions,

    errorFilter: (err) => {
      const status = err.response?.status;
      return status && status < 500;
    },
  },
);

breaker.on("open", () => logger.error("BORZO CIRCUIT OPEN"));
breaker.on("halfOpen", () => logger.warn("BORZO CIRCUIT HALF-OPEN"));
breaker.on("close", () => logger.info("BORZO CIRCUIT CLOSED"));

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
      url: config.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    throw error;
  }
};

client.get = (url, options = {}) => client({ method: "get", url, ...options });

client.post = (url, data, options = {}) =>
  client({ method: "post", url, data, ...options });

module.exports = client;
