require("dotenv").config();

const requiredInProduction = [
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "FRONTEND_URL",
  "CURRENCY",
  "BORZO_BASE_URL",
  "BORZO_API_TOKEN",
  "BORZO_CALLBACK_SECRET",
];

if (process.env.NODE_ENV === "production") {
  const missing = requiredInProduction.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }

  if (
    String(process.env.SMS_ENABLED).toLowerCase() === "true" &&
    !process.env.SMS_PROVIDER_URL
  ) {
    throw new Error(
      "Missing required production environment variables: SMS_PROVIDER_URL",
    );
  }

  const startMonth = process.env.INVOICE_FINANCIAL_YEAR_START_MONTH;
  if (startMonth !== undefined && (!/^\d+$/.test(startMonth) || Number(startMonth) < 1 || Number(startMonth) > 12)) {
    throw new Error("INVOICE_FINANCIAL_YEAR_START_MONTH must be an integer from 1 to 12");
  }

  const gstin = String(process.env.INVOICE_GSTIN || "").trim();
  if (gstin && !/^\d{2}[A-Z0-9]{13}$/i.test(gstin)) {
    throw new Error("INVOICE_GSTIN must be a valid 15-character GSTIN");
  }

  const invoicePrefix = String(process.env.INVOICE_PREFIX || "").trim();
  if (invoicePrefix && !/^[A-Z0-9]{2,10}$/i.test(invoicePrefix)) {
    throw new Error("INVOICE_PREFIX must contain 2 to 10 letters or numbers");
  }
}

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  DEFAULT_PROVIDER: process.env.DEFAULT_PROVIDER || "BORZO",

  BORZO: {
    BASE_URL: process.env.BORZO_BASE_URL,
    API_TOKEN: process.env.BORZO_API_TOKEN,
    CALLBACK_SECRET: process.env.BORZO_CALLBACK_SECRET,
  },
};
