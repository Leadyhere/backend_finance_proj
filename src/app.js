import compression from "compression";
import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";
import apiRoutes from "./routes.js";
import { createDemoSession } from "./controllers/authController.js";
import { apiLimiter, demoSessionLimiter } from "./middleware/rateLimiter.js";
import { sanitizeRequest, securityMiddleware } from "./middleware/securityMiddleware.js";
import { authenticate } from "./middleware/authMiddleware.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { getDatabaseHealth } from "./config/db.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { openApiSpec } from "./docs/openapi.js";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const applicationHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestLogger);
  app.use(securityMiddleware);
  app.use(apiLimiter);
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(sanitizeRequest);
  app.use(express.static(publicDirectory, { index: false, maxAge: "1d" }));

  app.get("/", (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(applicationHtml.replaceAll("__APP_ORIGIN__", origin));
  });
  app.get("/api", (_req, res) => {
    res.json({
      name: "Kosha Financial Intelligence API",
      version: "3.0.0",
      status: "running",
      application: "/",
      documentation: "/docs",
      openapi: "/openapi.json"
    });
  });
  app.get("/openapi.json", (_req, res) => res.json(openApiSpec));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: "Finance API Docs" }));

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

  app.post("/auth/demo", demoSessionLimiter, createDemoSession);
  app.use(authenticate);
  app.use(apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
