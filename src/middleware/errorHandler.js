import { captureException } from "../config/monitoring.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.originalUrl}`,
    requestId: req.id
  });
};

export const errorHandler = (error, req, res, _next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error";

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Request data failed validation";
  } else if (error.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${error.path || "identifier"}`;
  } else if (error.code === 11000) {
    statusCode = 409;
    message = "A record with these unique fields already exists";
  } else if (error.name === "MulterError") {
    statusCode = 400;
    message = error.code === "LIMIT_FILE_SIZE" ? "Screenshot must be 8 MB or smaller" : "Screenshot upload is invalid";
  }

  if (statusCode >= 500) {
    req.log?.error({ err: error, requestId: req.id }, "Unhandled request error");
    captureException(error, {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl
    });
    if (!error.isOperational) message = "Internal server error";
  }

  res.status(statusCode).json({
    message,
    requestId: req.id
  });
};
