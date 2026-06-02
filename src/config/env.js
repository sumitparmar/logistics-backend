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
