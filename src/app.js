require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");

const adminRoutes = require("./routes/admin.routes");
const protect = require("./middlewares/auth.middleware");

// RATE LIMITER
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

// INIT SERVICES
require("./config/redis");
require("./workers/otp.worker");

const errorHandler = require("./middlewares/errorHandler");
const authRoutes = require("./routes/auth.routes");
const ordersRoutes = require("./routes/orders.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const webhooksRoutes = require("./routes/webhooks.routes");
const reconciliationRoutes = require("./routes/reconciliation.routes");
const requestId = require("./middlewares/requestId");

const vehiclesRoutes = require("./routes/vehicles.routes");
const paymentsRoutes = require("./routes/payments.routes");
const paymentWebhookRoutes = require("./routes/paymentWebhooks.routes");
const providerCatalogRoutes = require("./routes/providerCatalog.routes");

const analyticsRoutes = require("./routes/analytics.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const addressRoutes = require("./routes/address.routes");

const app = express();

// TRUST PROXY (RENDER)
app.set("trust proxy", 1);

// REQUEST ID
app.use(requestId);

// SECURITY
app.use(helmet());

/* =========================
   CORS CONFIG (FINAL)
========================= */

const allowedOrigins = [
  "http://localhost:4200",
  "https://logistics-frontend-y0tk.onrender.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow no-origin (Postman, mobile apps)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    } else {
      console.log("❌ CORS BLOCKED:", origin);
      return callback(null, false); // do NOT throw error
    }
  },
  credentials: true,
};

// APPLY CORS
app.use(cors(corsOptions));

// HANDLE PREFLIGHT (CRITICAL)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

/* =========================
   MIDDLEWARE
========================= */

app.use(apiLimiter);

app.use(
  express.json({
    limit: "100kb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

/* =========================
   ROUTES
========================= */

app.use("/api/providers", providerCatalogRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", protect, analyticsRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/admin", protect, adminRoutes);
app.use("/api/payment-webhooks", paymentWebhookRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/addresses", protect, addressRoutes);
app.use("/api/meta", require("./routes/meta.routes"));

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "Backend running",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

/* =========================
   ERROR HANDLER (LAST)
========================= */

app.use(errorHandler);

module.exports = app;
