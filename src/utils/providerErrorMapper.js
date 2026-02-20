const providerErrors = require("../constants/providerErrors");

const mapProviderError = (providerResponse) => {
  const errorKey = providerResponse?.errors?.[0];

  if (!errorKey) {
    return {
      code: "PROVIDER_UNKNOWN_ERROR",
      message: "Unknown provider error",
      status: 500,
    };
  }

  return (
    providerErrors[errorKey] || {
      code: "PROVIDER_ERROR",
      message: "Provider request failed",
      status: 500,
    }
  );
};

module.exports = { mapProviderError };
