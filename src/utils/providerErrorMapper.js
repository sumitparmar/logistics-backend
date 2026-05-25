const providerErrors = require("../constants/providerErrors");

const flattenParameterErrors = (value, prefix = "") => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (item === null || item === undefined) return [];
      if (typeof item === "string") {
        return [`${prefix}: ${item}`];
      }
      return flattenParameterErrors(item, `${prefix}[${index}]`);
    });
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return flattenParameterErrors(child, path);
    });
  }

  return [`${prefix}: ${String(value)}`];
};

const mapProviderError = (providerResponse = {}) => {
  try {
    const response =
      providerResponse?.response?.data ||
      providerResponse?.raw ||
      providerResponse?.data ||
      providerResponse;

    // Extract error key safely
    const errorKey =
      response?.errors?.[0] || response?.error || response?.code || null;

    const parameterDetails = flattenParameterErrors(
      response?.parameter_errors || response?.parameter_warnings,
    );

    const providerMessage =
      response?.message ||
      (parameterDetails.length
        ? `Invalid provider parameters: ${parameterDetails.join("; ")}`
        : null) ||
      response?.errors?.join(", ") ||
      providerResponse?.message ||
      "Provider request failed";

    const providerStatus =
      providerResponse?.response?.status ||
      response?.status ||
      response?.statusCode ||
      providerResponse?.statusCode ||
      500;

    if (errorKey && providerErrors[errorKey]) {
      return {
        ...providerErrors[errorKey],
        message:
          parameterDetails.length && errorKey === "invalid_parameters"
            ? providerMessage
            : providerErrors[errorKey].message,
        details: parameterDetails,
        providerResponse: response,
      };
    }

    return {
      code: errorKey || "PROVIDER_UNKNOWN_ERROR",
      message: providerMessage,
      status: providerStatus,
      details: parameterDetails,
      providerResponse: response,
    };
  } catch (err) {
    return {
      code: "PROVIDER_ERROR",
      message: "Provider error mapping failed",
      status: 500,
      details: [],
    };
  }
};

const throwProviderError = (providerError) => {
  const mapped = mapProviderError(providerError);
  const err = new Error(mapped.message);
  err.statusCode = mapped.status;
  err.code = mapped.code;
  err.details = mapped.details;
  err.providerResponse = mapped.providerResponse;
  throw err;
};

module.exports = { mapProviderError, throwProviderError };
