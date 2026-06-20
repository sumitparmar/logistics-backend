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

      totalCredits: 0,
      totalDebits: 0,
      transactionCount: 0,

      pendingSettlement: 0,
      withdrawableBalance: 0,

      status: "ACTIVE",
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

  const creditAmount = Number(amount);
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    throw new Error("Invalid credit amount");
  }

  await Wallet.updateOne(
    { _id: wallet._id },
    {
      $inc: {
        balance: creditAmount,
        withdrawableBalance: creditAmount,
        totalCredits: creditAmount,
        transactionCount: 1,
      },

      $set: {
        lastTransactionAt: new Date(),
      },
    },
  );

  await LedgerEntry.create({
    wallet: wallet._id,

    type: "CREDIT",

    amount: creditAmount,

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

  const debitAmount = Number(amount);
  if (!Number.isFinite(debitAmount) || debitAmount <= 0) {
    throw new Error("Invalid debit amount");
  }

  const result = await Wallet.updateOne(
    {
      _id: wallet._id,
      balance: { $gte: debitAmount },
    },

    {
      $inc: {
        balance: -debitAmount,
        withdrawableBalance: -debitAmount,
        totalDebits: debitAmount,
        transactionCount: 1,
      },

      $set: {
        lastTransactionAt: new Date(),
      },
    },
  );

  if (result.modifiedCount === 0) {
    throw new Error("Insufficient wallet balance");
  }

  await LedgerEntry.create({
    wallet: wallet._id,

    type: "DEBIT",

    amount: debitAmount,

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
