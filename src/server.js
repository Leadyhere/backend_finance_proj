import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

let server;

const start = async () => {
  await connectDatabase();
  const app = createApp();
  server = app.listen(env.port, () => {
    console.log(`Finance backend running on port ${env.port}`);
  });
};

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down finance backend...`);

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
    console.error("Graceful shutdown failed", error);
    process.exit(1);
  }
};

start().catch((error) => {
  console.error("Failed to start finance backend", error);
  process.exit(1);
});

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal);
  });
});
