import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDatabase = async () => {
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error", error);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
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
