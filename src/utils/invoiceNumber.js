const InvoiceSequence = require("../models/InvoiceSequence");

const getFinancialYear = (date = new Date(), startMonth = 4) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const startYear = month >= startMonth ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
};

const normalizePrefix = (value) => {
  const prefix = String(value || "MK").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return prefix || "MK";
};

const allocateInvoiceNumber = async ({ prefix = "MK", date = new Date(), startMonth = 4 } = {}) => {
  const normalizedPrefix = normalizePrefix(prefix);
  const financialYear = getFinancialYear(date, startMonth);
  const key = `${normalizedPrefix}-${financialYear}`;

  const sequence = await InvoiceSequence.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        key,
        prefix: normalizedPrefix,
        financialYear,
        sequence: 0,
      },
      $inc: { sequence: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return `${normalizedPrefix}/${financialYear}/${String(sequence.sequence).padStart(6, "0")}`;
};

module.exports = {
  allocateInvoiceNumber,
  getFinancialYear,
};
