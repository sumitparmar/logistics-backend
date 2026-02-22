const { mapBorzoStatus } = require("./statusMapper");
const { transitionStatus } = require("../engines/status.engine");

/**
 * Normalizes provider order object into internal status
 */
function normalizeProviderStatus(order, borzoOrder) {
  const deliveryStatus =
    borzoOrder.points?.find((p) => p.delivery)?.delivery?.status || null;

  const providerStatus = deliveryStatus || borzoOrder.status;

  const mappedStatus = mapBorzoStatus(providerStatus);

  const nextStatus = transitionStatus(order.status, mappedStatus);

  return {
    mappedStatus,
    nextStatus,
  };
}

module.exports = normalizeProviderStatus;
