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
      return sendSuccess(res, [], "No ledger entries");
    }

    const ledger = await LedgerEntry.find({ wallet: wallet._id }).sort({
      createdAt: -1,
    });

    return sendSuccess(res, ledger, "Ledger fetched");
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
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
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
  getLedger,
  createPaymentIntentAndGatewayOrder,
  refundPayment,
};
