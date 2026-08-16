const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { buildInvoiceSnapshot } = require("../src/services/invoice.service");
const generateInvoicePdf = require("../src/utils/generateInvoicePdf");
const amountInWords = require("../src/utils/amountInWords");
const sanitizeInvoiceFilename = require("../src/utils/invoiceFilename");
const { getFinancialYear } = require("../src/utils/invoiceNumber");

const business = {
  legalName: "Configured MoveKart Legal Entity",
  registeredAddress: "Configured registered address",
  state: "Delhi",
  stateCode: "07",
  gstin: "07ABCDE1234F1Z5",
  pan: "ABCDE1234F",
  supportEmail: "support@example.test",
  supportPhone: "9999999999",
  currency: "INR",
  logoAsset: "movekart-logo.png",
  logoChecksum: null,
};

const makeOrder = (customer = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  borzoOrderId: "12345",
  user: "507f1f77bcf86cd799439012",
  status: "DELIVERED",
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  deliveredAt: new Date("2026-08-01T11:00:00.000Z"),
  customer: { name: "A Customer", phone: "9999999999", ...customer },
  pickup: { address: "Pickup address" },
  drop: { address: "Drop address" },
  deliveryType: "NOW",
  vehicleTypeId: 8,
  package: { weight: 1, description: "Documents" },
  payment: { method: "CASH", status: "PENDING" },
  pricing: {
    baseAmount: 100,
    taxableAmount: 120,
    gstRate: 18,
    gstAmount: 21.6,
    amount: 141.6,
    currency: "INR",
  },
  pricingSnapshot: {
    basePrice: 100,
    marginAmount: 10,
    platformFeeAmount: 5,
    handlingFeeAmount: 5,
    finalPrice: 120,
    gstPercent: 18,
    gstAmount: 21.6,
  },
  rawProviderResponse: {
    order: {
      payment_amount: "100.00",
      delivery_fee_amount: "90.00",
      weight_fee_amount: "10.00",
    },
  },
});

test("invoice snapshot reconciles line items, tax, and grand total", async () => {
  const snapshot = await buildInvoiceSnapshot(makeOrder(), { name: "A Customer", email: "customer@example.test" }, business);
  const lineTotal = snapshot.lineItems.reduce((sum, item) => sum + item.amount, 0);
  assert.equal(Number(lineTotal.toFixed(2)), snapshot.taxableSubtotal);
  assert.equal(Number((snapshot.taxableSubtotal + snapshot.taxBreakdown.total).toFixed(2)), snapshot.grandTotal);
  assert.equal(snapshot.taxBreakdown.type, "UNCLASSIFIED");
  assert.equal(snapshot.amountDue, snapshot.grandTotal);
});

test("invoice snapshot selects intra-state and inter-state GST without guessing missing jurisdiction", async () => {
  const intra = await buildInvoiceSnapshot(makeOrder({ stateCode: "07" }), { name: "A Customer", email: "customer@example.test" }, business);
  assert.equal(intra.taxBreakdown.type, "INTRA_STATE");
  assert.equal(intra.taxBreakdown.cgst, 10.8);
  assert.equal(intra.taxBreakdown.sgst, 10.8);

  const inter = await buildInvoiceSnapshot(makeOrder({ stateCode: "27" }), { name: "A Customer", email: "customer@example.test" }, business);
  assert.equal(inter.taxBreakdown.type, "INTER_STATE");
  assert.equal(inter.taxBreakdown.igst, 21.6);
});

test("invoice helpers produce Indian amount words, financial-year sequence keys, and safe filenames", () => {
  assert.equal(amountInWords(1234.5, "INR"), "INR one thousand two hundred thirty four and fifty paise only");
  assert.equal(getFinancialYear(new Date("2026-03-31T00:00:00Z"), 4), "2025-26");
  assert.equal(getFinancialYear(new Date("2026-04-01T00:00:00Z"), 4), "2026-27");
  assert.equal(sanitizeInvoiceFilename("MK/2026-27/000001"), "MoveKart-Invoice-MK-2026-27-000001.pdf");
});

test("invoice PDF is a selectable PDF generated from the stored snapshot", async () => {
  const snapshot = await buildInvoiceSnapshot(makeOrder(), { name: "A Customer", email: "customer@example.test" }, business);
  const invoice = {
    invoiceNumber: "MK/2026-27/000001",
    currency: "INR",
    issueDate: new Date("2026-08-01T12:00:00.000Z"),
    deliveredDate: snapshot.delivery.deliveredDate,
    bookingDate: snapshot.delivery.bookingDate,
    businessSnapshot: snapshot.business,
    customerSnapshot: snapshot.customer,
    deliverySnapshot: snapshot.delivery,
    paymentSnapshot: snapshot.payment,
    lineItems: snapshot.lineItems,
    taxableSubtotal: snapshot.taxableSubtotal,
    subtotal: snapshot.taxableSubtotal,
    tax: snapshot.taxBreakdown.total,
    taxBreakdown: snapshot.taxBreakdown,
    total: snapshot.grandTotal,
    grandTotal: snapshot.grandTotal,
    amountPaid: snapshot.amountPaid,
    amountDue: snapshot.amountDue,
    amountInWords: snapshot.amountInWords,
    roundingAdjustment: 0,
  };
  const pdf = await generateInvoicePdf(invoice);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 1000);
  assert.ok(fs.existsSync(path.resolve(__dirname, "../src/assets/movekart-logo.png")));
});
