import * as Sentry from "@sentry/node";
import { env } from "./env.js";

let enabled = false;

export const initializeMonitoring = () => {
  if (!env.sentryDsn || enabled) {
    return enabled;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: env.sentryTracesSampleRate,
    sendDefaultPii: false
  });
  enabled = true;
  return enabled;
};

export const captureException = (error, context = {}) => {
  if (!enabled) {
    return null;
  }

  return Sentry.captureException(error, {
    extra: context
  });
};
