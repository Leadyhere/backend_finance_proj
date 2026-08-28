import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { env } from "../config/env.js";

export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }),
  cors({
    origin: [env.clientUrl],
    credentials: true
  }),
  (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  }
];

export const sanitizeRequest = mongoSanitize();
