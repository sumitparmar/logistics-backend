const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const User = require("../models/User");
const SystemSettings = require("../models/SystemSettings");
const { allocateInvoiceNumber } = require("../utils/invoiceNumber");
const amountInWords = require("../utils/amountInWords");
const sanitizeInvoiceFilename = require("../utils/invoiceFilename");
const { getOrderReference } = require("../utils/orderReference");

const TEMPLATE_VERSION = "1.0";
const PDF_RENDER_VERSION = "2.0";
const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const isNonZero = (value) => Math.abs(Number(value || 0)) >= 0.01;

const providerOrderFrom = (order) =>
  order?.rawProviderResponse?.order ||
  order?.rawProviderResponse?.orders?.[0] ||
  null;

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? roundMoney(number) : 0;
};

const getInvoiceBusinessConfig = async () => {
  const settings = (await SystemSettings.findOne().lean()) || {};
  const invoice = settings.invoice || {};
  const logoPath =
    process.env.INVOICE_LOGO_PATH ||
    path.resolve(__dirname, "../assets/movekart-logo.png");

  let logoChecksum = null;
  try {
    logoChecksum = crypto
      .createHash("sha256")
      .update(fs.readFileSync(logoPath))
      .digest("hex");
  } catch {
    logoChecksum = null;
  }

  return {
    legalName:
      invoice.legalName ||
      process.env.INVOICE_LEGAL_NAME ||
      settings.platformName ||
      "MoveKart Logistics",
    registeredAddress:
      invoice.registeredAddress || process.env.INVOICE_BUSINESS_ADDRESS || "",
    state: invoice.state || process.env.INVOICE_BUSINESS_STATE || "",
    stateCode: String(
      invoice.stateCode || process.env.INVOICE_BUSINESS_STATE_CODE || "",
    ),
    gstin: invoice.gstin || process.env.INVOICE_GSTIN || "",
    pan: invoice.pan || process.env.INVOICE_PAN || "",
    sacCode: invoice.sacCode || process.env.INVOICE_SAC_CODE || "",
    supportEmail:
      invoice.supportEmail ||
      settings.supportEmail ||
      process.env.INVOICE_SUPPORT_EMAIL ||
      process.env.EMAIL_USER ||
      "",
    supportPhone:
      invoice.supportPhone ||
      settings.supportPhone ||
      process.env.INVOICE_SUPPORT_PHONE ||
      "",
    currency:
      invoice.currency ||
      settings.currency ||
      process.env.CURRENCY ||
      "INR",
    prefix: invoice.prefix || process.env.INVOICE_PREFIX || "MK",
    financialYearStartMonth: Number(
      invoice.financialYearStartMonth ||
        process.env.INVOICE_FINANCIAL_YEAR_START_MONTH ||
        4,
    ),
    templateVersion:
      invoice.templateVersion ||
      process.env.INVOICE_TEMPLATE_VERSION ||
      TEMPLATE_VERSION,
    logoAsset: "movekart-logo.png",
    logoChecksum,
    logoPath,
  };
};

const providerComponentDefinitions = [
  ["delivery_fee_amount", "Delivery charge", "DELIVERY"],
  ["weight_fee_amount", "Weight charge", "WEIGHT"],
  ["insurance_fee_amount", "Insurance charge", "INSURANCE"],
  ["loading_fee_amount", "Loading charge", "LOADING"],
  ["money_transfer_fee_amount", "Money transfer charge", "MONEY_TRANSFER"],
  ["cod_fee_amount", "COD service charge", "COD"],
  ["return_fee_amount", "Return charge", "RETURN"],
  ["waiting_fee_amount", "Waiting charge", "WAITING"],
];

const buildLineItems = (order, pricingSnapshot) => {
  const providerOrder = providerOrderFrom(order);
  const providerPayment = numberOrZero(
    providerOrder?.payment_amount ?? order.pricing?.baseAmount,
  );
  const lineItems = [];
  const discounts = [];
  const adjustments = [];

  if (providerOrder) {
    for (const [field, label, code] of providerComponentDefinitions) {
      const amount = numberOrZero(providerOrder[field]);
      if (isNonZero(amount)) {
        lineItems.push({ code, label, amount, quantity: 1, taxable: true });
      }
    }

    const promoDiscount = numberOrZero(providerOrder.promo_code_discount_amount);
    if (isNonZero(promoDiscount)) {
      const discount = {
        code: "PROMO_DISCOUNT",
        label: "Promotional discount",
        amount: -promoDiscount,
        quantity: 1,
        taxable: true,
      };
      lineItems.push(discount);
      discounts.push(discount);
    }
  }

  if (!lineItems.length && isNonZero(providerPayment)) {
    lineItems.push({
      code: "DELIVERY_SERVICE",
      label: "Delivery service",
      amount: providerPayment,
      quantity: 1,
      taxable: true,
    });
  }

  const providerLineTotal = roundMoney(
    lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );
  const providerAdjustment = roundMoney(providerPayment - providerLineTotal);
  if (isNonZero(providerAdjustment)) {
    const adjustment = {
      code: "PROVIDER_ADJUSTMENT",
      label: "Provider pricing adjustment",
      amount: providerAdjustment,
      quantity: 1,
      taxable: true,
    };
    lineItems.push(adjustment);
    adjustments.push(adjustment);
  }

  const margin = numberOrZero(pricingSnapshot.marginAmount);
  const platformFee = numberOrZero(pricingSnapshot.platformFeeAmount);
  const handlingFee = numberOrZero(pricingSnapshot.handlingFeeAmount);
  const taxableSubtotal = numberOrZero(
    order.pricing?.taxableAmount ??
      pricingSnapshot.finalPrice ??
      order.pricing?.amount - order.pricing?.gstAmount,
  );

  const administrativeLines = [
    [margin, "Service margin", "SERVICE_MARGIN"],
    [platformFee, "Platform fee", "PLATFORM_FEE"],
    [handlingFee, "Handling fee", "HANDLING_FEE"],
  ];

  for (const [amount, label, code] of administrativeLines) {
    if (!isNonZero(amount)) continue;
    const line = { code, label, amount, quantity: 1, taxable: true };
    lineItems.push(line);
  }

  const knownTotal = roundMoney(
    providerPayment + margin + platformFee + handlingFee,
  );
  const administrativeAdjustment = roundMoney(taxableSubtotal - knownTotal);
  if (isNonZero(administrativeAdjustment)) {
    const adjustment = {
      code: "PRICING_ADJUSTMENT",
      label: "Pricing adjustment",
      amount: administrativeAdjustment,
      quantity: 1,
      taxable: true,
    };
    lineItems.push(adjustment);
    adjustments.push(adjustment);
  }

  const lineTotal = roundMoney(
    lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );
  const roundingAdjustment = roundMoney(taxableSubtotal - lineTotal);
  if (isNonZero(roundingAdjustment)) {
    const adjustment = {
      code: "ROUNDING",
      label: "Rounding adjustment",
      amount: roundingAdjustment,
      quantity: 1,
      taxable: true,
    };
    lineItems.push(adjustment);
    adjustments.push(adjustment);
  }

  return { lineItems, discounts, adjustments, taxableSubtotal };
};

const buildTaxBreakdown = (order, business, customer) => {
  const total = numberOrZero(
    order.pricing?.gstAmount ?? order.pricingSnapshot?.gstAmount,
  );
  const rate = numberOrZero(
    order.pricing?.gstRate ?? order.pricingSnapshot?.gstPercent,
  );
  const businessStateCode = String(business.stateCode || "").trim();
  const customerStateCode = String(customer.stateCode || "").trim();
  let type = "NONE";
  if (isNonZero(total)) {
    type =
      businessStateCode && customerStateCode
        ? businessStateCode === customerStateCode
          ? "INTRA_STATE"
          : "INTER_STATE"
        : "UNCLASSIFIED";
  }

  const cgst = type === "INTRA_STATE" ? roundMoney(total / 2) : 0;
  const sgst = type === "INTRA_STATE" ? roundMoney(total - cgst) : 0;
  const igst = type === "INTER_STATE" ? total : 0;

  return {
    type,
    rate,
    total,
    cgst,
    sgst,
    igst,
    businessStateCode: businessStateCode || null,
    customerStateCode: customerStateCode || null,
  };
};

const buildInvoiceSnapshot = async (order, user, business) => {
  const customer = {
    name: order.customer?.name || user.name || "Customer",
    billingName: order.billing?.name || order.customer?.name || user.name || "Customer",
    email: user.email || order.customer?.email || null,
    phone: order.customer?.phone || user.phone || null,
    billingAddress: order.billing?.address || order.customer?.billingAddress || null,
    state: order.billing?.state || order.customer?.state || null,
    stateCode: order.billing?.stateCode || order.customer?.stateCode || null,
    gstin: order.billing?.gstin || order.customer?.gstin || null,
  };
  const pricingSnapshot = order.pricingSnapshot || {};
  const lineData = buildLineItems(order, pricingSnapshot);
  const taxBreakdown = buildTaxBreakdown(order, business, customer);
  const grandTotal = numberOrZero(order.pricing?.amount);
  const amountPaid =
    order.payment?.status === "PAID" ? grandTotal : 0;
  const amountDue = roundMoney(Math.max(grandTotal - amountPaid, 0));
  const providerOrder = providerOrderFrom(order);
  const vehicleTypeId =
    order.vehicleTypeId || order.vehicle?.type || providerOrder?.vehicle_type_id || null;

  const deliverySnapshot = {
    orderReference: getOrderReference(order.borzoOrderId || order._id),
    internalOrderReference: String(order._id),
    bookingDate: order.createdAt,
    deliveredDate: order.deliveredAt,
    status: order.status,
    deliveryType: order.deliveryType || null,
    vehicleTypeId,
    pickup: order.pickup || null,
    drop: order.drop || null,
    stops: order.stops || [],
    package: order.package || null,
    provider: order.provider || "BORZO",
    providerReference: order.borzoOrderId || null,
    distance: order.distance || order.pricing?.distance || null,
  };

  return {
    business: {
      legalName: business.legalName,
      registeredAddress: business.registeredAddress,
      state: business.state,
      stateCode: business.stateCode || null,
      gstin: business.gstin || null,
      pan: business.pan || null,
      sacCode: business.sacCode || null,
      supportEmail: business.supportEmail || null,
      supportPhone: business.supportPhone || null,
      currency: business.currency,
      invoiceTitle: business.gstin
        ? "Tax Invoice/ Consignment Note"
        : "Bill of Supply/ Consignment Note",
      logoAsset: business.logoAsset,
      logoChecksum: business.logoChecksum,
    },
    customer,
    delivery: deliverySnapshot,
    payment: {
      method: order.payment?.method || "CASH",
      status: order.payment?.status || "PENDING",
      gateway: order.payment?.gateway || null,
      reference:
        order.payment?.transactionId ||
        order.payment?.gatewayPaymentId ||
        providerOrder?.payment_id ||
        null,
      codEnabled: Boolean(order.cod?.enabled),
      codAmount: numberOrZero(order.cod?.amount),
      codCollectedAmount: numberOrZero(order.cod?.collectedAmount),
    },
    lineItems: lineData.lineItems,
    discounts: lineData.discounts,
    adjustments: lineData.adjustments,
    taxableSubtotal: lineData.taxableSubtotal,
    taxBreakdown,
    grandTotal,
    amountPaid,
    amountDue,
    amountInWords: amountInWords(grandTotal, business.currency),
  };
};

const createInvoiceForOrder = async (order) => {
  if (!order || order.status !== "DELIVERED") {
    const error = new Error("Invoice can only be created for a delivered order");
    error.statusCode = 409;
    throw error;
  }

  const user = await User.findById(order.user).lean();
  if (!user) {
    const error = new Error("Invoice customer could not be verified");
    error.statusCode = 422;
    throw error;
  }

  const business = await getInvoiceBusinessConfig();
  const snapshot = await buildInvoiceSnapshot(order, user, business);
  const issueDate = new Date();
  const invoiceNumber = await allocateInvoiceNumber({
    prefix: business.prefix,
    date: issueDate,
    startMonth: business.financialYearStartMonth,
  });

  try {
    return await Invoice.create({
      invoiceNumber,
      order: order._id,
      user: order.user,
      status: "ISSUED",
      currency: business.currency,
      businessSnapshot: snapshot.business,
      customerSnapshot: snapshot.customer,
      deliverySnapshot: snapshot.delivery,
      paymentSnapshot: snapshot.payment,
      lineItems: snapshot.lineItems,
      subtotal: snapshot.taxableSubtotal,
      taxableSubtotal: snapshot.taxableSubtotal,
      tax: snapshot.taxBreakdown.total,
      taxBreakdown: snapshot.taxBreakdown,
      discounts: snapshot.discounts,
      adjustments: snapshot.adjustments,
      roundingAdjustment: snapshot.adjustments.find((item) => item.code === "ROUNDING")?.amount || 0,
      total: snapshot.grandTotal,
      grandTotal: snapshot.grandTotal,
      amountPaid: snapshot.amountPaid,
      amountDue: snapshot.amountDue,
      amountInWords: snapshot.amountInWords,
      issueDate,
      deliveredDate: order.deliveredAt || issueDate,
      bookingDate: order.createdAt || issueDate,
      templateVersion: business.templateVersion,
      email: {
        status: snapshot.customer.email ? "PENDING" : "NOT_AVAILABLE",
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Invoice.findOne({ order: order._id });
      if (existing) return existing;
    }
    throw error;
  }
};

const upgradeLegacyInvoiceSnapshot = async (invoice, order) => {
  if (invoice.businessSnapshot?.legalName && invoice.deliverySnapshot?.orderReference) {
    return invoice;
  }

  const user = await User.findById(order.user).lean();
  if (!user) {
    const error = new Error("Invoice customer could not be verified");
    error.statusCode = 422;
    throw error;
  }

  const business = await getInvoiceBusinessConfig();
  const currentSnapshot = await buildInvoiceSnapshot(order, user, business);
  const legacySubtotal = numberOrZero(invoice.taxableSubtotal ?? invoice.subtotal);
  const legacyTax = numberOrZero(invoice.tax);
  const legacyTotal = numberOrZero(invoice.grandTotal ?? invoice.total);
  const legacyAmountPaid = numberOrZero(invoice.amountPaid);
  const legacyAmountDue = numberOrZero(
    invoice.amountDue ?? Math.max(legacyTotal - legacyAmountPaid, 0),
  );

  const update = {
    $set: {
        currency: invoice.currency || business.currency,
        businessSnapshot: currentSnapshot.business,
        customerSnapshot: currentSnapshot.customer,
        deliverySnapshot: currentSnapshot.delivery,
        paymentSnapshot: currentSnapshot.payment,
        lineItems: Array.isArray(invoice.lineItems) ? invoice.lineItems : [],
        subtotal: legacySubtotal,
        taxableSubtotal: legacySubtotal,
        tax: legacyTax,
        taxBreakdown: {
          type: "UNCLASSIFIED",
          rate: 0,
          total: legacyTax,
          cgst: 0,
          sgst: 0,
          igst: 0,
          businessStateCode: null,
          customerStateCode: null,
        },
        grandTotal: legacyTotal,
        total: legacyTotal,
        amountPaid: legacyAmountPaid,
        amountDue: legacyAmountDue,
        amountInWords: invoice.amountInWords || amountInWords(legacyTotal, invoice.currency || business.currency),
        templateVersion: invoice.templateVersion || "legacy-1.0",
        issueDate: invoice.issueDate || invoice.createdAt || new Date(),
        deliveredDate: invoice.deliveredDate || order.deliveredAt || new Date(),
        bookingDate: invoice.bookingDate || order.createdAt || new Date(),
        "email.status": invoice.email?.status || (currentSnapshot.customer.email ? "PENDING" : "NOT_AVAILABLE"),
    },
  };

  // Legacy records predate immutable snapshots. Use the collection update only
  // for this controlled backfill, while preserving every stored financial value.
  await Invoice.collection.updateOne({ _id: invoice._id }, update);
  return Invoice.findById(invoice._id).select("+pdf.data");
};

const ensureInvoiceForDeliveredOrder = async (order) => {
  if (!order || order.status !== "DELIVERED") return null;

  let invoice = await Invoice.findOne({ order: order._id }).select("+pdf.data");
  if (!invoice) invoice = await createInvoiceForOrder(order);

  if (!invoice.businessSnapshot?.legalName || !invoice.deliverySnapshot?.orderReference) {
    invoice = await upgradeLegacyInvoiceSnapshot(invoice, order);
  }

  if (!invoice.pdf?.data || invoice.pdf.templateVersion !== PDF_RENDER_VERSION) {
    const generateInvoicePdf = require("../utils/generateInvoicePdf");
    const pdfBuffer = await generateInvoicePdf(invoice);
    const checksum = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    invoice = await Invoice.findByIdAndUpdate(
      invoice._id,
      {
        $set: {
          pdf: {
            data: pdfBuffer,
            filename: sanitizeInvoiceFilename(invoice.invoiceNumber),
            contentType: "application/pdf",
            checksum,
            size: pdfBuffer.length,
            generatedAt: new Date(),
            templateVersion: PDF_RENDER_VERSION,
          },
        },
      },
      { new: true },
    );
  }

  return invoice;
};

const processDeliveredOrder = async (order) => {
  try {
    const invoice = await ensureInvoiceForDeliveredOrder(order);
    if (invoice) {
      const { enqueueInvoiceEmail } = require("./invoiceEmail.service");
      await enqueueInvoiceEmail(invoice._id);
    }
    return invoice;
  } catch (error) {
    console.error("INVOICE PROCESSING ERROR:", error.message);
    return null;
  }
};

module.exports = {
  buildInvoiceSnapshot,
  createInvoiceForOrder,
  ensureInvoiceForDeliveredOrder,
  processDeliveredOrder,
  getInvoiceBusinessConfig,
  PDF_RENDER_VERSION,
};
