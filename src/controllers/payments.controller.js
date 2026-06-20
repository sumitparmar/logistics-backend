const paymentMethods = require("../constants/paymentMethods");
const { sendSuccess } = require("../utils/response");
const {
  createPaymentIntent,
  markProcessing,
} = require("../services/paymentIntent.service");
const { createGatewayOrder } = require("../services/gateway.service");
const PaymentIntent = require("../models/PaymentIntent");
const {
  creditWallet,
  debitWallet,
  getWallet,
} = require("../services/wallet.service");
const { requestRefund } = require("../services/refund.service");
const LedgerEntry = require("../models/LedgerEntry");
const Wallet = require("../models/Wallet");

// PAYMENT METHODS (STATIC)

const getPaymentMethods = async (req, res) => {
  return sendSuccess(res, paymentMethods, "Payment methods fetched");
};

// PAY-IN

const payIn = async (req, res, next) => {
  try {
    const { amount, reason, reference, metadata } = req.body;

    const wallet = await creditWallet({
      userId: req.user._id,
      amount,
      reason: reason || "MANUAL_PAYIN",
      reference,
      metadata,
    });

    return sendSuccess(res, wallet, "Pay-in successful");
  } catch (err) {
    next(err);
  }
};

// PAY-OUT

const payOut = async (req, res, next) => {
  try {
    const { amount, reason, reference, metadata } = req.body;

    const wallet = await debitWallet({
      userId: req.user._id,
      amount,
      reason: reason || "MANUAL_PAYOUT",
      reference,
      metadata,
    });

    return sendSuccess(res, wallet, "Pay-out successful");
  } catch (err) {
    next(err);
  }
};

// GET WALLET

const getWalletBalance = async (req, res, next) => {
  try {
    const wallet = await getWallet(req.user._id);
    return sendSuccess(res, wallet, "Wallet fetched");
  } catch (err) {
    next(err);
  }
};

// GET LEDGER

const getLedger = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return sendSuccess(
        res,
        {
          items: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            pages: 0,
          },
        },
        "No ledger entries",
      );
    }

    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const { type, search } = req.query;

    const filter = {
      wallet: wallet._id,
    };

    if (type && type !== "ALL") {
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        {
          reason: {
            $regex: search,
            $options: "i",
          },
        },
        {
          reference: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const total = await LedgerEntry.countDocuments(filter);

    const items = await LedgerEntry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendSuccess(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Ledger fetched",
    );
  } catch (err) {
    next(err);
  }
};

// GET WALLET SUMMARY

const getWalletSummary = async (req, res, next) => {
  try {
    const wallet = await getWallet(req.user._id);

    const creditTransactions = await LedgerEntry.countDocuments({
      wallet: wallet._id,
      type: "CREDIT",
    });

    const debitTransactions = await LedgerEntry.countDocuments({
      wallet: wallet._id,
      type: "DEBIT",
    });

    return sendSuccess(
      res,
      {
        availableBalance: wallet.balance,

        withdrawableBalance: wallet.withdrawableBalance,

        totalCredits: wallet.totalCredits,

        totalDebits: wallet.totalDebits,

        transactionCount: wallet.transactionCount,

        creditTransactions,

        debitTransactions,

        pendingSettlement: wallet.pendingSettlement,

        currency: wallet.currency,

        status: wallet.status,

        lastTransactionAt: wallet.lastTransactionAt,
      },
      "Wallet summary fetched",
    );
  } catch (err) {
    next(err);
  }
};

const createPaymentIntentAndGatewayOrder = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    //  Create internal intent first
    const intent = await createPaymentIntent({
      userId: req.user._id,
      amount,
      paymentMethod,
    });

    //  Create Razorpay order
    const gatewayOrder = await createGatewayOrder({
      amount: intent.amount,
      currency: intent.currency,
    });

    // Attach gateway order ID
    intent.gatewayOrderId = gatewayOrder.id;
    await intent.save();

    await markProcessing(intent._id);

    return sendSuccess(
      res,
      {
        intentId: intent._id,
        gatewayOrderId: gatewayOrder.id,
        amount: intent.amount,
        currency: intent.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
      "Payment intent created",
    );
  } catch (err) {
    next(err);
  }
};

const refundPayment = async (req, res, next) => {
  try {
    const { intentId, reason } = req.body;

    if (!intentId) {
      const err = new Error("intentId is required");
      err.statusCode = 400;
      throw err;
    }

    const intent = await requestRefund({
      intentId,
      reason,
    });

    return sendSuccess(
      res,
      {
        intentId: intent._id,
        status: intent.status,
      },
      "Refund initiated",
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPaymentMethods,

  payIn,
  payOut,

  getWalletBalance,
  getWalletSummary,
  getLedger,

  createPaymentIntentAndGatewayOrder,

  refundPayment,
};
