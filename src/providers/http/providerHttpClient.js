const axios = require("axios");

const DEFAULT_TIMEOUT = 10000;

const client = axios.create({
  timeout: DEFAULT_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

function normalizeError(error) {
  if (error.response) {
    return {
      success: false,
      statusCode: error.response.status,
      message:
        error.response.data?.message ||
        error.response.data?.error ||
        "Provider responded with error",
      raw: error.response.data,
    };
  }

  if (error.code === "ECONNABORTED") {
    return {
      success: false,
      statusCode: 504,
      message: "Provider timeout",
      raw: null,
    };
  }

  return {
    success: false,
    statusCode: 500,
    message: "Provider communication failed",
    raw: error.message,
  };
}

async function execute(config, retry = true) {
  try {
    const response = await client(config);
    return response.data;
  } catch (err) {
    if (retry) {
      return execute(config, false);
    }

    throw normalizeError(err);
  }
}

module.exports = {
  execute,
};
