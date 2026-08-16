require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const adminRoutes = require("./routes/admin.routes");
const protect = require("./middlewares/auth.middleware");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const errorHandler = require("./middlewares/errorHandler");
const authRoutes = require("./routes/auth.routes");
const ordersRoutes = require("./routes/orders.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const webhooksRoutes = require("./routes/webhooks.routes");
const reconciliationRoutes = require("./routes/reconciliation.routes");
const requestId = require("./middlewares/requestId");
const cors = require("cors");
const vehiclesRoutes = require("./routes/vehicles.routes");
const paymentsRoutes = require("./routes/payments.routes");
const paymentWebhookRoutes = require("./routes/paymentWebhooks.routes");
const providerCatalogRoutes = require("./routes/providerCatalog.routes");
const app = express(); // FIRST create app
const analyticsRoutes = require("./routes/analytics.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const addressRoutes = require("./routes/address.routes");
const driverOnboardingRoutes = require("./routes/driverOnboarding.routes");

const customerNotificationsRoutes = require("./routes/customerNotifications.routes");
// MUST BE FIRST
app.set("trust proxy", 1);

// Request ID
app.use(requestId);

// Security
app.use(helmet());

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const developmentOrigins = ["http://localhost:4200", "http://localhost:3000"];

const allowedOrigins = [
  ...configuredOrigins,
  ...(process.env.NODE_ENV === "production" ? [] : developmentOrigins),
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Idempotency-Key",
  ],
  exposedHeaders: ["Content-Disposition", "Content-Length"],
  credentials: true,
};

app.use(cors(corsOptions));

app.use("/api/providers", providerCatalogRoutes);
app.use(apiLimiter);
app.use(
  express.json({
    limit: "100kb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

// Routes
app.use("/api/orders", ordersRoutes);
app.use("/api/support", require("./routes/support.routes"));
app.use("/api/customer-notifications", customerNotificationsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", protect, analyticsRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment-webhooks", paymentWebhookRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/addresses", protect, addressRoutes);
app.use("/api/driver-onboarding", driverOnboardingRoutes);
app.use("/api/meta", require("./routes/meta.routes"));
// Health
app.get("/", (req, res) => {
  res.json({
    status: "Backend running",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Error Handler (last)
app.use(errorHandler);

module.exports = app;
