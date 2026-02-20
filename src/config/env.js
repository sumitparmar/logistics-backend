require("dotenv").config();

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
