const mongoose = require("mongoose");

const invoiceLineItemSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true },
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    taxable: { type: Boolean, default: true },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      trim: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: ["GENERATED", "ISSUED", "CANCELLED", "VOID"],
      default: "ISSUED",
      index: true,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      immutable: true,
    },

    businessSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    customerSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    deliverySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    paymentSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    lineItems: {
      type: [invoiceLineItemSchema],
      required: true,
      immutable: true,
    },

    subtotal: {
      type: Number,
      required: true,
      immutable: true,
    },

    taxableSubtotal: {
      type: Number,
      required: true,
      immutable: true,
    },

    tax: {
      type: Number,
      default: 0,
      immutable: true,
    },

    taxBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    discounts: {
      type: [invoiceLineItemSchema],
      default: [],
      immutable: true,
    },

    adjustments: {
      type: [invoiceLineItemSchema],
      default: [],
      immutable: true,
    },

    roundingAdjustment: {
      type: Number,
      default: 0,
      immutable: true,
    },

    total: {
      type: Number,
      required: true,
      immutable: true,
    },

    grandTotal: {
      type: Number,
      required: true,
      immutable: true,
    },

    amountPaid: {
      type: Number,
      default: 0,
      immutable: true,
    },

    amountDue: {
      type: Number,
      default: 0,
      immutable: true,
    },

    amountInWords: {
      type: String,
      required: true,
      immutable: true,
    },

    issueDate: {
      type: Date,
      required: true,
      immutable: true,
    },

    deliveredDate: {
      type: Date,
      required: true,
      immutable: true,
    },

    bookingDate: {
      type: Date,
      required: true,
      immutable: true,
    },

    templateVersion: {
      type: String,
      required: true,
      immutable: true,
    },

    pdf: {
      data: { type: Buffer, select: false },
      filename: { type: String, trim: true },
      contentType: { type: String, default: "application/pdf" },
      checksum: { type: String, trim: true },
      size: { type: Number, min: 0 },
      generatedAt: { type: Date },
    },

    email: {
      status: {
        type: String,
        enum: ["PENDING", "QUEUED", "SENT", "FAILED", "NOT_AVAILABLE"],
        default: "PENDING",
      },
      attempts: { type: Number, default: 0, min: 0 },
      lastAttemptAt: { type: Date, default: null },
      sentAt: { type: Date, default: null },
      messageId: { type: String, default: null },
      lastError: { type: String, default: null, maxlength: 500 },
      processingToken: { type: String, default: null, select: false },
      processingAt: { type: Date, default: null, select: false },
    },
  },
  { timestamps: true },
);

invoiceSchema.index({ order: 1 }, { unique: true });
invoiceSchema.index({ user: 1, issueDate: -1 });
invoiceSchema.index({ "email.status": 1, "email.lastAttemptAt": 1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
