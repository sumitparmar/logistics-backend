const providerErrors = require("../constants/providerErrors");

const mapProviderError = (providerResponse = {}) => {
  try {
    // Extract error key safely
    const errorKey =
      providerResponse?.errors?.[0] ||
      providerResponse?.error ||
      providerResponse?.code ||
      null;

    // Extract message fallback
    const providerMessage =
      providerResponse?.message ||
      providerResponse?.errors?.join(", ") ||
      "Provider request failed";

    // Extract status if available
    const providerStatus =
      providerResponse?.status || providerResponse?.statusCode || 500;

    // If mapped error exists
    if (errorKey && providerErrors[errorKey]) {
      return providerErrors[errorKey];
    }

    // Unknown but structured error
    return {
      code: errorKey || "PROVIDER_UNKNOWN_ERROR",
      message: providerMessage,
      status: providerStatus,
    };
  } catch (err) {
    return {
      code: "PROVIDER_ERROR",
      message: "Provider error mapping failed",
      status: 500,
    };
  }
};

module.exports = { mapProviderError };
