module.exports = {
  invalid_vehicle_type: {
    code: "INVALID_VEHICLE_TYPE",
    message: "Invalid vehicle type selected",
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
