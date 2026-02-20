const winston = require("winston");
const path = require("path");

const logDir = path.join(__dirname, "logs");

const logger = winston.createLogger({
  level: "info",

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),

  transports: [
    // Console logs
    new winston.transports.Console(),

    // All logs
    new winston.transports.File({
      filename: path.join(logDir, "app.log"),
    }),

    // Errors only
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
  ],
});

module.exports = logger;
