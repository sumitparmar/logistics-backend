function applyAdminPricing({ basePrice, config, vehicleType }) {
  let price = basePrice;

  // Margin
  if (config.marginPercent) {
    price += (price * config.marginPercent) / 100;
  }

  // Base fees
  price += config.baseFees?.platformFee || 0;
  price += config.baseFees?.handlingFee || 0;

  // Vehicle override
  const vehicle = config.vehicleOverrides?.find((v) => v.type === vehicleType);
  if (vehicle) {
    price *= vehicle.multiplier;
  }

  // Surge
  if (config.surge?.enabled) {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    if (
      config.surge.startTime &&
      config.surge.endTime &&
      currentTime >= config.surge.startTime &&
      currentTime <= config.surge.endTime
    ) {
      price *= config.surge.multiplier;
    }
  }

  return Math.round(price);
}

module.exports = { applyAdminPricing };
