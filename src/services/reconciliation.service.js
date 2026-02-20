const Order = require("../models/Order");
const Reconciliation = require("../models/Reconciliation");
const pulseService = require("./pulse.service");

const reconcileOrders = async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const orders = await Order.find({
    provider: "BORZO",
    createdAt: { $gte: since },
  });

  for (const order of orders) {
    if (!order.borzoOrderId) continue;

    let providerData;

    try {
      providerData = await pulseService.getOrder(order.borzoOrderId);
    } catch {
      continue;
    }

    if (!providerData?.is_successful || !providerData.orders?.length) continue;

    const borzoOrder = providerData.orders[0];

    const providerAmount = Number(borzoOrder.payment_amount);
    const expectedAmount = Number(order.pricing.amount);

    const providerStatus = borzoOrder.status;
    const localStatus = order.status;

    const statusMatches = providerStatus?.toUpperCase() === localStatus;

    const amountMatches = providerAmount === expectedAmount;

    // Find existing reconciliation row
    const existing = await Reconciliation.findOne({
      order: order._id,
      resolved: false,
    });

    if (!statusMatches || !amountMatches) {
      // create or update mismatch
      if (existing) {
        existing.providerAmount = providerAmount;
        existing.expectedAmount = expectedAmount;
        existing.difference = providerAmount - expectedAmount;
        existing.providerStatus = providerStatus;
        existing.localStatus = localStatus;
        existing.checkedAt = new Date();
        await existing.save();
      } else {
        await Reconciliation.create({
          order: order._id,
          borzoOrderId: order.borzoOrderId,
          providerAmount,
          expectedAmount,
          difference: providerAmount - expectedAmount,
          providerStatus,
          localStatus,
          resolved: false,
          checkedAt: new Date(),
        });
      }
    } else if (existing) {
      // mismatch resolved
      existing.resolved = true;
      await existing.save();
    }
  }
};

module.exports = {
  reconcileOrders,
};
