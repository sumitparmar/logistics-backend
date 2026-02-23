const CourierWallet = require("../models/CourierWallet");
const CourierLedgerEntry = require("../models/CourierLedgerEntry");

async function getOrCreateWallet(courierId) {
  let wallet = await CourierWallet.findOne({ courierId });

  if (!wallet) {
    wallet = await CourierWallet.create({ courierId });
  }

  return wallet;
}

async function creditCourier({
  courierId,
  amount,
  reason,
  reference,
  metadata,
}) {
  const wallet = await getOrCreateWallet(courierId);

  wallet.balance += Number(amount);
  await wallet.save();

  await CourierLedgerEntry.create({
    wallet: wallet._id,
    type: "CREDIT",
    amount,
    reason,
    reference,
    metadata,
  });

  return wallet;
}

async function debitCourier({
  courierId,
  amount,
  reason,
  reference,
  metadata,
}) {
  const wallet = await getOrCreateWallet(courierId);

  if (wallet.balance < amount) {
    throw new Error("Courier insufficient balance");
  }

  wallet.balance -= Number(amount);
  await wallet.save();

  await CourierLedgerEntry.create({
    wallet: wallet._id,
    type: "DEBIT",
    amount,
    reason,
    reference,
    metadata,
  });

  return wallet;
}

module.exports = {
  creditCourier,
  debitCourier,
  getOrCreateWallet,
};
