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
  const vehicle = config.vehicleOverrides?.find(
    (v) => String(v.type) === String(vehicleType),
  );
  if (vehicle?.multiplier && vehicle.multiplier > 0) {
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

  return Number(price.toFixed(2));
}

function calculateAdminPricing({ basePrice, config, vehicleType }) {
  const subtotal = applyAdminPricing({ basePrice, config, vehicleType });
  const gstPercent = Number(config?.tax?.gstPercent ?? 18);
  const gstEnabled = config?.tax?.gstEnabled !== false;
  const gstAmount = gstEnabled
    ? Number(((subtotal * gstPercent) / 100).toFixed(2))
    : 0;
  const finalAmount = Number((subtotal + gstAmount).toFixed(2));

  return {
    subtotal,
    gstEnabled,
    gstPercent: gstEnabled ? gstPercent : 0,
    gstAmount,
    finalAmount,
  };
}

module.exports = { applyAdminPricing, calculateAdminPricing };
