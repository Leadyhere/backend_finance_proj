import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { Migration } from "../src/models/Migration.js";
import { Budget } from "../src/models/Budget.js";
import { Expense } from "../src/models/Expense.js";
import { ExpenseImport } from "../src/models/ExpenseImport.js";
import { Investment } from "../src/models/Investment.js";
import { InvestmentGoal } from "../src/models/InvestmentGoal.js";
import { InvestmentNewsletter } from "../src/models/InvestmentNewsletter.js";
import { Loan } from "../src/models/Loan.js";
import { PortfolioPlan } from "../src/models/PortfolioPlan.js";
import { User } from "../src/models/User.js";
import { logger } from "../src/config/logger.js";

const migrations = [
  {
    name: "2026-08-portfolio-intelligence-indexes",
    up: async () => {
      for (const model of [User, Expense, ExpenseImport, Budget, Investment, InvestmentGoal, Loan, PortfolioPlan, InvestmentNewsletter]) {
        await model.createIndexes();
      }
    }
  }
];

try {
  await connectDatabase();
  for (const migration of migrations) {
    const applied = await Migration.exists({ name: migration.name });
    if (applied) {
      logger.info({ migration: migration.name }, "Migration already applied");
      continue;
    }
    await migration.up();
    await Migration.create({ name: migration.name });
    logger.info({ migration: migration.name }, "Migration applied");
  }
  await disconnectDatabase();
} catch (error) {
  logger.fatal({ err: error }, "Migration failed");
  process.exitCode = 1;
  await disconnectDatabase().catch(() => {});
}
