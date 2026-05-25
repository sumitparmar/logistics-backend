module.exports = {
  invalid_vehicle_type: {
    code: "INVALID_VEHICLE_TYPE",
    message: "Invalid vehicle type selected",
    status: 400,
  },

  invalid_parameters: {
    code: "INVALID_PROVIDER_PARAMETERS",
    message: "Borzo rejected one or more order fields",
    status: 400,
  },

  different_regions: {
    code: "DIFFERENT_REGIONS",
    message:
      "Pickup and drop addresses are in different Borzo service regions. Please choose addresses within the same service region.",
    status: 400,
  },

  invalid_region: {
    code: "INVALID_REGION",
    message: "One of the selected addresses is outside Borzo service coverage.",
    status: 400,
  },

  address_not_found: {
    code: "ADDRESS_NOT_FOUND",
    message: "Borzo could not geocode one of the selected addresses.",
    status: 400,
  },

  coordinates_out_of_bounds: {
    code: "COORDINATES_OUT_OF_BOUNDS",
    message: "Selected coordinates are outside Borzo delivery coverage.",
    status: 400,
  },

  invalid_phone: {
    code: "INVALID_PHONE",
    message: "Recipient or sender phone number is invalid for Borzo.",
    status: 400,
  },

  invalid_order_status: {
    code: "INVALID_ORDER_STATUS",
    message: "Invalid order status",
    status: 400,
  },

  insufficient_balance: {
    code: "INSUFFICIENT_BALANCE",
    message: "Insufficient balance to place order",
    status: 402,
  },

  route_not_found: {
    code: "ROUTE_NOT_FOUND",
    message: "Route not found for selected addresses",
    status: 400,
  },

  impossible_delivery_fee_calculation: {
    code: "PRICE_CALCULATION_FAILED",
    message: "Borzo could not calculate a delivery fee for this route.",
    status: 400,
  },

  requests_limit_exceeded: {
    code: "BORZO_RATE_LIMITED",
    message: "Borzo API rate limit exceeded. Please try again shortly.",
    status: 429,
  },

  required_auth_token: {
    code: "BORZO_AUTH_MISSING",
    message: "Borzo auth token is missing on the server.",
    status: 502,
  },

  invalid_auth_token: {
    code: "BORZO_AUTH_INVALID",
    message: "Borzo auth token is invalid. Check BORZO_API_TOKEN.",
    status: 502,
  },

  service_unavailable: {
    code: "BORZO_SERVICE_UNAVAILABLE",
    message: "Borzo is temporarily unavailable. Please try again.",
    status: 503,
  },

  order_is_duplicate: {
    code: "DUPLICATE_ORDER",
    message: "Duplicate order detected",
    status: 409,
  },

  unexpected_error: {
    code: "PROVIDER_ERROR",
    message: "Unexpected provider error",
    status: 500,
  },
};
