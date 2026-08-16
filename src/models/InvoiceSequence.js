const mongoose = require("mongoose");

const invoiceSequenceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    prefix: { type: String, required: true, trim: true },
    financialYear: { type: String, required: true, trim: true },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("InvoiceSequence", invoiceSequenceSchema);
