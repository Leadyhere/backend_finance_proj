import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils.js";

export const authenticate = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication token is required"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"]
    });

    if (!payload.user_id || typeof payload.user_id !== "string") {
      throw new ApiError(401, "Invalid token payload");
    }

    req.user = {
      user_id: payload.user_id,
      email: payload.email || null
    };

    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};
