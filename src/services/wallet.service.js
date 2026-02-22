const Wallet = require("../models/Wallet");
const LedgerEntry = require("../models/LedgerEntry");

/**
 * Get or create wallet
 */
const getWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });

  if (!wallet) {
    wallet = await Wallet.create({
      user: userId,
      balance: 0,
      currency: "INR",
    });
  }

  return wallet;
};

/**
 * Credit wallet
 */
const creditWallet = async ({
  userId,
  amount,
  reason,
  reference,
  metadata,
}) => {
  const wallet = await getWallet(userId);

  const newBalance = wallet.balance + Number(amount);

  await Wallet.updateOne(
    { _id: wallet._id },
    { $set: { balance: newBalance } },
  );

  await LedgerEntry.create({
    wallet: wallet._id,
    type: "CREDIT",
    amount: Number(amount),
    reason,
    reference,
    metadata,
  });

  return await Wallet.findById(wallet._id);
};

/**
 * Debit wallet
 */
const debitWallet = async ({ userId, amount, reason, reference, metadata }) => {
  const wallet = await getWallet(userId);

  if (wallet.balance < Number(amount)) {
    throw new Error("Insufficient wallet balance");
  }

  const newBalance = wallet.balance - Number(amount);

  await Wallet.updateOne(
    { _id: wallet._id },
    { $set: { balance: newBalance } },
  );

  await LedgerEntry.create({
    wallet: wallet._id,
    type: "DEBIT",
    amount: Number(amount),
    reason,
    reference,
    metadata,
  });

  return await Wallet.findById(wallet._id);
};

module.exports = {
  getWallet,
  creditWallet,
  debitWallet,
};
