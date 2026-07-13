const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const LedgerEntry = require("../models/LedgerEntry");
/**
 * Get or create wallet
 */

const getWallet = async (userId, session = null) => {
  let wallet = await Wallet.findOne({ user: userId }).session(session);

  if (!wallet) {
    const wallets = await Wallet.create(
      [
        {
          user: userId,
          balance: 0,
          currency: "INR",

          totalCredits: 0,
          totalDebits: 0,
          transactionCount: 0,

          pendingSettlement: 0,
          withdrawableBalance: 0,

          status: "ACTIVE",
        },
      ],
      { session },
    );

    wallet = wallets[0];
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
  category = "SYSTEM",
  description = "",
  order = null,
  performedBy = null,
  session = null,
}) => {
  const ownSession = !session;

  if (!session) {
    session = await mongoose.startSession();
  }

  try {
    if (ownSession) {
      session.startTransaction();
    }

    const wallet = await getWallet(userId, session);
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
      { session },
    );

    const updatedWallet = await Wallet.findById(wallet._id).session(session);

    await LedgerEntry.create(
      [
        {
          wallet: wallet._id,

          type: "CREDIT",

          amount: creditAmount,

          reason,

          category,

          description,

          order,

          performedBy,

          reference,

          metadata,

          balanceBefore: updatedWallet.balance - creditAmount,

          balanceAfter: updatedWallet.balance,
        },
      ],
      { session },
    );

    if (ownSession) {
      await session.commitTransaction();
    }
    return updatedWallet;
  } catch (err) {
    if (ownSession) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    if (ownSession) {
      session.endSession();
    }
  }
};

/**
 * Debit wallet
 */

const debitWallet = async ({
  userId,
  amount,
  reason,
  reference,
  metadata,
  category = "SYSTEM",
  description = "",
  order = null,
  performedBy = null,
  session = null,
}) => {
  const ownSession = !session;

  if (!session) {
    session = await mongoose.startSession();
  }

  try {
    if (ownSession) {
      session.startTransaction();
    }

    const wallet = await getWallet(userId, session);

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
      { session },
    );

    if (result.modifiedCount === 0) {
      throw new Error("Insufficient wallet balance");
    }

    const updatedWallet = await Wallet.findById(wallet._id).session(session);

    await LedgerEntry.create(
      [
        {
          wallet: wallet._id,

          type: "DEBIT",

          amount: debitAmount,

          reason,

          category,

          description,

          order,

          performedBy,

          reference,

          metadata,

          balanceBefore: updatedWallet.balance + debitAmount,

          balanceAfter: updatedWallet.balance,
        },
      ],
      { session },
    );

    if (ownSession) {
      await session.commitTransaction();
    }
    return updatedWallet;
  } catch (err) {
    if (ownSession) {
      await session.abortTransaction();
    }

    throw err;
  } finally {
    if (ownSession) {
      session.endSession();
    }
  }
};

module.exports = {
  getWallet,
  creditWallet,
  debitWallet,

  getWalletBalance: async (userId) => {
    const wallet = await getWallet(userId);

    return wallet.balance;
  },
};
