module.exports = {
  invalid_vehicle_type: {
    code: "INVALID_VEHICLE_TYPE",
    message: "Invalid vehicle type selected",
    status: 400,
  },

  invalid_parameters: {
    code: "INVALID_PROVIDER_PARAMETERS",
    message: "One or more delivery details could not be accepted",
    status: 400,
  },

  different_regions: {
    code: "DIFFERENT_REGIONS",
    message:
      "Pickup and drop addresses are in different service regions. Please choose addresses within the same service region.",
    status: 400,
  },

  invalid_region: {
    code: "INVALID_REGION",
    message: "One of the selected addresses is outside MoveKart service coverage.",
    status: 400,
  },

  address_not_found: {
    code: "ADDRESS_NOT_FOUND",
    message: "We could not locate one of the selected addresses.",
    status: 400,
  },

  coordinates_out_of_bounds: {
    code: "COORDINATES_OUT_OF_BOUNDS",
    message: "Selected coordinates are outside MoveKart delivery coverage.",
    status: 400,
  },

  invalid_phone: {
    code: "INVALID_PHONE",
    message: "Recipient or sender phone number is invalid.",
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
    message: "We could not calculate a delivery fee for this route.",
    status: 400,
  },

  requests_limit_exceeded: {
    code: "BORZO_RATE_LIMITED",
    message: "Too many requests were sent. Please try again shortly.",
    status: 429,
  },

  required_auth_token: {
    code: "BORZO_AUTH_MISSING",
    message: "Delivery service configuration is incomplete. Please try again later.",
    status: 502,
  },

  invalid_auth_token: {
    code: "BORZO_AUTH_INVALID",
    message: "Delivery service authentication failed. Please try again later.",
    status: 502,
  },

  service_unavailable: {
    code: "BORZO_SERVICE_UNAVAILABLE",
    message: "Delivery service is temporarily unavailable. Please try again.",
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
