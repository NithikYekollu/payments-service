const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { logger } = require("./utils/logger");
const transferRoutes = require("./routes/transfers");
const paymentRoutes = require("./routes/payments");
const refundRoutes = require("./routes/refunds");
const webhookRoutes = require("./routes/webhooks");
const ledgerRoutes = require("./routes/ledger");
const { errorHandler } = require("./middleware/errorHandler");
const { authMiddleware } = require("./middleware/auth");
const { apiRateLimiter } = require("./middleware/rateLimit");

const app = express();
const PORT = process.env.PORT || 3001;

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "payments-service", version: "2.4.1" });
});

// Webhook routes (no auth — Stripe signs these)
app.use("/api/v1/webhooks", webhookRoutes);

// Authenticated routes (with rate limiting)
app.use("/api/v1/transfers", authMiddleware, apiRateLimiter, transferRoutes);
app.use("/api/v1/payments", authMiddleware, apiRateLimiter, paymentRoutes);
app.use("/api/v1/refunds", authMiddleware, apiRateLimiter, refundRoutes);
app.use("/api/v1/ledger", authMiddleware, apiRateLimiter, ledgerRoutes);

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Payments service listening on port ${PORT}`);
});

module.exports = app;
