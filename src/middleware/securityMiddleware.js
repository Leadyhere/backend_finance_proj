import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { env } from "../config/env.js";

export const securityMiddleware = [
  helmet(),
  cors({
    origin: [env.clientUrl],
    credentials: true
  }),
  mongoSanitize(),
  (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  }
];
