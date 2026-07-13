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
const ExcelJS = require("exceljs");

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

    const {
      type,
      category,
      status,
      search,
      fromDate,
      toDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {
      wallet: wallet._id,
    };

    if (type && type !== "ALL") {
      filter.type = type;
    }

    if (category && category !== "ALL") {
      filter.category = category;
    }

    if (status && status !== "ALL") {
      filter.status = status;
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
        {
          description: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (fromDate || toDate) {
      filter.createdAt = {};

      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }

      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);

        filter.createdAt.$lte = end;
      }
    }

    const total = await LedgerEntry.countDocuments(filter);

    const allowedSortFields = [
      "createdAt",
      "amount",
      "status",
      "reason",
      "balanceBefore",
      "balanceAfter",
    ];
    const finalSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";

    const items = await LedgerEntry.find(filter)
      .populate({
        path: "order",
        select: "borzoOrderId status deliveryType pickup drop pricing.amount",
      })
      .sort({
        [finalSortBy]: sortOrder === "asc" ? 1 : -1,
      })
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

const downloadStatement = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({
      user: req.user._id,
    });

    if (!wallet) {
      const err = new Error("Wallet not found");
      err.statusCode = 404;
      throw err;
    }

    const entries = await LedgerEntry.find({
      wallet: wallet._id,
    })
      .populate({
        path: "order",
        select: "borzoOrderId",
      })
      .sort({
        createdAt: -1,
      });

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet("Wallet Statement");

    sheet.columns = [
      {
        header: "Date",
        key: "date",
        width: 24,
      },
      {
        header: "Type",
        key: "type",
        width: 14,
      },
      {
        header: "Reason",
        key: "reason",
        width: 28,
      },
      {
        header: "Category",
        key: "category",
        width: 18,
      },
      {
        header: "Reference",
        key: "reference",
        width: 28,
      },
      {
        header: "Order",
        key: "order",
        width: 20,
      },
      {
        header: "Status",
        key: "status",
        width: 18,
      },
      {
        header: "Credit",
        key: "credit",
        width: 16,
      },
      {
        header: "Debit",
        key: "debit",
        width: 16,
      },
      {
        header: "Balance After",
        key: "balance",
        width: 18,
      },
    ];

    sheet.getRow(1).font = {
      bold: true,
    };

    entries.forEach((entry) => {
      sheet.addRow({
        date: entry.createdAt,
        type: entry.type,
        reason: entry.reason,
        category: entry.category,
        reference: entry.reference || "",
        order: entry.order?.borzoOrderId || "",
        status: entry.status,
        credit: entry.type === "CREDIT" ? entry.amount : "",
        debit: entry.type === "DEBIT" ? entry.amount : "",
        balance: entry.balanceAfter,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=wallet-statement-${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);

    res.end();
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
  downloadStatement,

  createPaymentIntentAndGatewayOrder,

  refundPayment,
};
