import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initializeMonitoring } from "./config/monitoring.js";

let server;

const start = async () => {
  initializeMonitoring();
  await connectDatabase();
  const app = createApp();
  server = app.listen(env.port, () => {
    logger.info({ port: env.port }, "Finance backend started");
  });
};

const shutdown = async (signal) => {
  logger.info({ signal }, "Shutting down finance backend");

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Graceful shutdown failed");
    process.exit(1);
  }
};

start().catch((error) => {
  logger.fatal({ err: error }, "Failed to start finance backend");
  process.exit(1);
});

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal);
  });
});
