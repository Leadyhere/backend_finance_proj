import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      "req.headers.authorization",
      "authorization",
      "token",
      "password",
      "apiKey",
      "marketDataApiKey"
    ],
    censor: "[REDACTED]"
  }
});
