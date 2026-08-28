import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { logger } from "../config/logger.js";

export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const requestId = req.headers["x-request-id"] || randomUUID();
    res.setHeader("X-Request-Id", requestId);
    return requestId;
  },
  customProps(req) {
    return req.user?.user_id ? { userId: req.user.user_id } : {};
  }
});
