import { createHash } from "node:crypto";
import { Expense } from "../models/Expense.js";
import { ExpenseImport } from "../models/ExpenseImport.js";
import { Investment } from "../models/Investment.js";
import { parseQueryDate } from "../middleware/validate.js";
import { ApiError, getMonthRange } from "../utils.js";
import { extractExpensesFromScreenshot } from "./aiService.js";

const colors = { needs: "#22c55e", wants: "#f59e0b", luxury: "#ef4444", uncategorized: "#94a3b8" };

export const createExpenseImport = async (userId, file) => {
  const sha256 = createHash("sha256").update(file.buffer).digest("hex");
  const existing = await ExpenseImport.findOne({ user_id: userId, "source.sha256": sha256 }).lean();
  if (existing) return { ...existing, duplicate: true };

  const analysis = await extractExpensesFromScreenshot(userId, file);
  if (!analysis.items.length) {
    throw new ApiError(422, "No expense amounts could be extracted. Try a clearer screenshot or enter the items manually.");
  }
  const ocrPreview = analysis.items
    .map((item) => `${item.date.toISOString().slice(0, 10)} ${item.description} ${item.amount}`)
    .join(" | ")
    .slice(0, 1000);
  const expenseImport = await ExpenseImport.create({
    user_id: userId,
    source: { fileName: file.originalname, mimeType: file.mimetype, size: file.size, sha256 },
    ocrConfidence: analysis.confidence,
    ocrPreview,
    items: analysis.items
  });
  return expenseImport.toObject();
};

export const confirmExpenseImport = async (userId, importId) => {
  const expenseImport = await ExpenseImport.findOneAndUpdate(
    { _id: importId, user_id: userId, status: "draft" },
    { status: "processing" },
    { new: true }
  );
  if (!expenseImport) {
    const existing = await ExpenseImport.findOne({ _id: importId, user_id: userId }).lean();
    if (!existing) throw new ApiError(404, "Expense import not found");
    if (existing.status === "confirmed") return existing;
    throw new ApiError(409, "Expense import is already being processed or cannot be confirmed");
  }

  try {
    const expenses = await Expense.insertMany(expenseImport.items.map((item) => ({
      user_id: userId,
      amount: item.amount,
      category: item.category,
      description: item.description,
      merchant: item.merchant,
      date: item.date,
      necessityType: item.necessityType,
      classificationSource: "screenshot_ai",
      potentialSavings: item.potentialSavings,
      import_id: expenseImport._id,
      tags: ["screenshot-import"],
      notes: "Automatically logged from AI screenshot import"
    })));
    expenseImport.status = "confirmed";
    expenseImport.confirmedAt = new Date();
    expenseImport.confirmedExpenseIds = expenses.map((expense) => expense._id);
    await expenseImport.save();
    return expenseImport.toObject();
  } catch (error) {
    await ExpenseImport.updateOne({ _id: expenseImport._id }, { status: "draft" });
    throw error;
  }
};

const aggregatePeriod = async (userId, start, end = new Date()) => {
  const data = await Expense.aggregate([
    { $match: { user_id: userId, date: { $gte: start, $lt: end } } },
    { $group: {
      _id: { $ifNull: ["$necessityType", "uncategorized"] },
      total: { $sum: "$amount" },
      potentialSavings: { $sum: { $ifNull: ["$potentialSavings", 0] } },
      count: { $sum: 1 }
    } }
  ]);
  const totalSpent = data.reduce((sum, item) => sum + item.total, 0);
  const breakdown = ["needs", "wants", "luxury", "uncategorized"].map((type) => {
    const item = data.find((entry) => entry._id === type) || { total: 0, potentialSavings: 0, count: 0 };
    return {
      type,
      total: Number(item.total.toFixed(2)),
      potentialSavings: Number(item.potentialSavings.toFixed(2)),
      count: item.count,
      percentage: totalSpent ? Number(((item.total / totalSpent) * 100).toFixed(1)) : 0,
      color: colors[type]
    };
  });
  return {
    start,
    end,
    totalSpent: Number(totalSpent.toFixed(2)),
    potentialSavings: Number(data.reduce((sum, item) => sum + item.potentialSavings, 0).toFixed(2)),
    breakdown
  };
};

export const getExpenseClassificationAnalytics = async (userId, { startDate, endDate } = {}) => {
  const now = new Date();
  const currentMonth = getMonthRange(now);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const firstInvestment = await Investment.findOne({ user_id: userId }).sort({ purchaseDate: 1 }).lean();
  const firstExpense = await Expense.findOne({ user_id: userId }).sort({ date: 1 }).lean();
  const journeyStart = firstInvestment?.purchaseDate || firstExpense?.date || currentMonth.start;
  const selectedStart = startDate ? parseQueryDate(startDate, "Analytics start date") : currentMonth.start;
  const selectedEnd = endDate ? parseQueryDate(endDate, "Analytics end date", { endExclusive: true }) : now;
  if (selectedStart >= selectedEnd) throw new ApiError(400, "Analytics date range is invalid");

  const [selected, month, year, journey, allTime] = await Promise.all([
    aggregatePeriod(userId, selectedStart, selectedEnd),
    aggregatePeriod(userId, currentMonth.start, now),
    aggregatePeriod(userId, yearStart, now),
    aggregatePeriod(userId, new Date(journeyStart), now),
    aggregatePeriod(userId, new Date(0), now)
  ]);
  const observedMonths = Math.max(1,
    (now.getFullYear() - new Date(journeyStart).getFullYear()) * 12 +
      now.getMonth() - new Date(journeyStart).getMonth() + 1
  );
  const averageMonthlyPotential = Number((journey.potentialSavings / observedMonths).toFixed(2));

  return {
    selected,
    periods: { currentMonth: month, currentYear: year, investmentJourney: journey, allTime },
    savingsEstimates: {
      currentMonthPotential: month.potentialSavings,
      currentYearPotential: year.potentialSavings,
      averageMonthlyPotential,
      annualizedPotential: Number((averageMonthlyPotential * 12).toFixed(2)),
      investmentJourneyPotential: journey.potentialSavings,
      investmentJourneyStart: journeyStart,
      methodology: "Potential savings count 50% of wants and 80% of luxury spending; needs and unclassified expenses contribute 0. Annualized potential is the observed monthly average multiplied by 12."
    },
    chart: {
      type: "pie",
      labels: selected.breakdown.map((item) => item.type),
      values: selected.breakdown.map((item) => item.total),
      colors: selected.breakdown.map((item) => item.color),
      svgEndpoint: "/expense-analytics/classification/chart.svg"
    }
  };
};

export const renderExpensePieChart = (analytics) => {
  const segments = analytics.selected.breakdown.filter((item) => item.percentage > 0);
  let offset = 0;
  const circles = segments.map((item) => {
    const circle = `<circle cx="100" cy="100" r="70" fill="none" stroke="${item.color}" stroke-width="38" pathLength="100" stroke-dasharray="${item.percentage} ${100 - item.percentage}" stroke-dashoffset="-${offset}" transform="rotate(-90 100 100)"/>`;
    offset += item.percentage;
    return circle;
  }).join("");
  const legend = analytics.selected.breakdown.map((item, index) =>
    `<g transform="translate(210 ${35 + index * 32})"><rect width="16" height="16" rx="3" fill="${item.color}"/><text x="24" y="13" font-family="Arial, sans-serif" font-size="14" fill="#e2e8f0">${item.type}: ${item.percentage}% (${item.total.toFixed(2)})</text></g>`
  ).join("");
  const empty = segments.length ? "" : '<text x="100" y="105" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#94a3b8">No data</text>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="240" viewBox="0 0 560 240"><rect width="100%" height="100%" rx="16" fill="#0f172a"/><text x="24" y="28" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#f8fafc">Expense classification</text>${circles}${empty}${legend}<text x="24" y="226" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Potential savings: ${analytics.selected.potentialSavings.toFixed(2)}</text></svg>`;
};
