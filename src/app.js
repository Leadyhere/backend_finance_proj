import compression from "compression";
import express from "express";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import goalRoutes from "./routes/goalRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import loanRoutes from "./routes/loanRoutes.js";
import marketRoutes from "./routes/marketRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import summaryRoutes from "./routes/summaryRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { securityMiddleware } from "./middleware/securityMiddleware.js";
import { authenticate } from "./middleware/authMiddleware.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { getDatabaseHealth } from "./config/db.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityMiddleware);
  app.use(apiLimiter);
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/health", async (_req, res) => {
    const db = await getDatabaseHealth();
    res.json({
      status: "ok",
      module: "finance",
      database: db.status,
      uptime: process.uptime()
    });
  });

  app.get("/ready", async (_req, res) => {
    const db = await getDatabaseHealth();
    const ready = db.status === "connected";

    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      module: "finance",
      database: db.status
    });
  });

  app.use(authenticate);
  app.use("/auth", authRoutes);
  app.use("/profile", profileRoutes);
  app.use("/expenses", expenseRoutes);
  app.use("/budget", budgetRoutes);
  app.use("/goals", goalRoutes);
  app.use("/investments", investmentRoutes);
  app.use("/loans", loanRoutes);
  app.use("/market-overview", marketRoutes);
  app.use("/dashboard", dashboardRoutes);
  app.use("/finance-summary", summaryRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
