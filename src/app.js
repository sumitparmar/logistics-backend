require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const adminRoutes = require("./routes/admin.routes");
const protect = require("./middlewares/auth.middleware");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // requests per IP
  standardHeaders: true,
  legacyHeaders: false,
});

const errorHandler = require("./middlewares/errorHandler");
const authRoutes = require("./routes/auth.routes");
const ordersRoutes = require("./routes/orders.routes");
const webhooksRoutes = require("./routes/webhooks.routes");
const reconciliationRoutes = require("./routes/reconciliation.routes");
const requestId = require("./middlewares/requestId");
const cors = require("cors");
// const xss = require("xss-clean");
// const mongoSanitize = require("express-mongo-sanitize");
const vehiclesRoutes = require("./routes/vehicles.routes");
const paymentsRoutes = require("./routes/payments.routes");
const paymentWebhookRoutes = require("./routes/paymentWebhooks.routes");

const app = express(); // FIRST create app

// MUST BE FIRST
app.set("trust proxy", 1);

// Request ID
app.use(requestId);

// Security
app.use(helmet());
app.use(cors());
app.use(apiLimiter);
app.use(
  express.json({
    limit: "100kb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

// app.use(xss());
// app.use(mongoSanitize());

// Routes
app.use("/api/orders", ordersRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/admin", protect, adminRoutes);
app.use("/api/payment-webhooks", paymentWebhookRoutes);

// Health
app.get("/", (req, res) => {
  res.json({ status: "Backend running" });
});

// Error Handler (last)
app.use(errorHandler);

module.exports = app;
