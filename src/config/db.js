import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const connectDatabase = async () => {
  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected");
  });

  mongoose.connection.on("error", (error) => {
    logger.error({ err: error }, "MongoDB connection error");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  await mongoose.connect(env.dbUri, {
    serverSelectionTimeoutMS: 10000
  });
};

export const disconnectDatabase = async () => {
  await mongoose.connection.close();
};

export const getDatabaseHealth = async () => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  const state = states[mongoose.connection.readyState] || "unknown";

  if (mongoose.connection.readyState !== 1) {
    return { status: state };
  }

  try {
    await mongoose.connection.db.admin().ping();
    return { status: "connected" };
  } catch {
    return { status: "degraded" };
  }
};
