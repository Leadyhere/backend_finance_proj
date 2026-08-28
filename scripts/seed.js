import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { logger } from "../src/config/logger.js";
import { ensureDemoWorkspace } from "../src/services/financeService.js";

const userId = process.env.SEED_USER_ID || "resume-demo-user";

try {
  await connectDatabase();
  await ensureDemoWorkspace(userId);
  logger.info({ userId }, "Demo workspace seeded");
  await disconnectDatabase();
} catch (error) {
  logger.fatal({ err: error }, "Seeding failed");
  process.exitCode = 1;
  await disconnectDatabase().catch(() => {});
}
