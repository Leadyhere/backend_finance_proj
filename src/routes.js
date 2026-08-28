import { Router } from "express";
import multer from "multer";
import { getSession } from "./controllers/authController.js";
import { createBudget, getBudgets, updateBudget } from "./controllers/budgetController.js";
import { getDashboard } from "./controllers/dashboardController.js";
import { createExpense, deleteExpense, getExpenses, updateExpense } from "./controllers/expenseController.js";
import {
  analyzeExpenseScreenshot,
  readExpenseClassificationAnalytics,
  readExpenseClassificationChart
} from "./controllers/expenseIntelligenceController.js";
import { createGoal, deleteGoal, getGoals, updateGoal } from "./controllers/goalController.js";
import { createInvestment, deleteInvestment, getInvestments, updateInvestment } from "./controllers/investmentController.js";
import { createLoan, deleteLoan, getLoans, updateLoan } from "./controllers/loanController.js";
import { getMarketOverview } from "./controllers/marketController.js";
import {
  acknowledgeNewsletter,
  createPortfolioRecommendation,
  readCurrentNewsletter,
  readPortfolioRecommendation
} from "./controllers/portfolioController.js";
import { calculateInflation, getProfile, updateProfile } from "./controllers/profileController.js";
import { generateAiAdvisorInsight, getAdvisorAssessment, getFinanceSummary } from "./controllers/summaryController.js";
import { validateObjectId } from "./middleware/validate.js";
import { aiRequestLimiter, screenshotImportLimiter } from "./middleware/rateLimiter.js";
import { ApiError } from "./utils.js";

const router = Router();
const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = ["image/png", "image/jpeg"];
    callback(
      allowed.includes(file.mimetype)
        ? null
        : new ApiError(400, "Screenshot must be a PNG or JPEG image"),
      allowed.includes(file.mimetype)
    );
  }
});

router.get("/auth/session", getSession);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.post("/inflation/calculate", calculateInflation);

router.post("/expenses", createExpense);
router.get("/expenses", getExpenses);
router.put("/expenses/:id", validateObjectId(), updateExpense);
router.patch("/expenses/:id", validateObjectId(), updateExpense);
router.delete("/expenses/:id", validateObjectId(), deleteExpense);

router.post(
  "/expense-imports/screenshot",
  screenshotImportLimiter,
  screenshotUpload.single("screenshot"),
  analyzeExpenseScreenshot
);
router.get("/expense-analytics/classification", readExpenseClassificationAnalytics);
router.get("/expense-analytics/classification/chart.svg", readExpenseClassificationChart);

router.post("/budget", createBudget);
router.get("/budget", getBudgets);
router.put("/budget", updateBudget);

router.post("/goals", createGoal);
router.get("/goals", getGoals);
router.put("/goals/:id", validateObjectId(), updateGoal);
router.patch("/goals/:id", validateObjectId(), updateGoal);
router.delete("/goals/:id", validateObjectId(), deleteGoal);

router.post("/investments", createInvestment);
router.get("/investments", getInvestments);
router.put("/investments/:id", validateObjectId(), updateInvestment);
router.patch("/investments/:id", validateObjectId(), updateInvestment);
router.delete("/investments/:id", validateObjectId(), deleteInvestment);

router.post("/loans", createLoan);
router.get("/loans", getLoans);
router.put("/loans/:id", validateObjectId(), updateLoan);
router.patch("/loans/:id", validateObjectId(), updateLoan);
router.delete("/loans/:id", validateObjectId(), deleteLoan);

router.get("/market-overview", getMarketOverview);
router.get("/dashboard", getDashboard);
router.get("/finance-summary", getFinanceSummary);
router.get("/advisor/assessment", getAdvisorAssessment);
router.post("/advisor/ai-insight", aiRequestLimiter, generateAiAdvisorInsight);

router.post("/portfolio/recommendation", createPortfolioRecommendation);
router.get("/portfolio/recommendation", readPortfolioRecommendation);
router.get("/portfolio/newsletter/current", readCurrentNewsletter);
router.post("/portfolio/newsletter/:id/read", validateObjectId(), acknowledgeNewsletter);

export default router;
