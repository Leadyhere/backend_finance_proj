import { Budget } from "../models/Budget.js";
import { Expense } from "../models/Expense.js";
import { InvestmentGoal } from "../models/InvestmentGoal.js";
import { Investment } from "../models/Investment.js";
import { Loan } from "../models/Loan.js";
import { User } from "../models/User.js";
import { formatMonthKey, getLastMonths, getMonthRange } from "../utils/date.js";

const toCurrency = (value) => Number(Number(value || 0).toFixed(2));

const sumBy = (items, selector) =>
  items.reduce((total, item) => total + Number(selector(item) || 0), 0);

export const getBudgetSnapshot = async (userId, month = formatMonthKey(new Date())) => {
  const budgets = await Budget.find({ user_id: userId, month }).lean();
  const overallBudget = budgets.find((item) => item.category === "overall");
  const categoryBudgets = budgets.filter((item) => item.category !== "overall");

  return {
    monthlyBudget: overallBudget?.amount || 0,
    alertThreshold: overallBudget?.alertThreshold || 80,
    categoryBudgets
  };
};

export const getMonthlyExpenseTotal = async (userId, monthDate = new Date()) => {
  const { start, end } = getMonthRange(monthDate);
  const result = await Expense.aggregate([
    {
      $match: {
        user_id: userId,
        date: {
          $gte: start,
          $lt: end
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" }
      }
    }
  ]);

  return result[0]?.total || 0;
};

export const getCategoryBreakdown = async (userId, monthDate = new Date()) => {
  const { start, end } = getMonthRange(monthDate);
  const data = await Expense.aggregate([
    {
      $match: {
        user_id: userId,
        date: { $gte: start, $lt: end }
      }
    },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$amount" }
      }
    },
    { $sort: { total: -1 } }
  ]);

  return data.map((item) => ({
    category: item._id,
    total: toCurrency(item.total)
  }));
};

export const getMonthlySpendingTrend = async (userId) => {
  const months = getLastMonths(6);

  return Promise.all(
    months.map(async (monthDate) => ({
      month: formatMonthKey(monthDate),
      total: toCurrency(await getMonthlyExpenseTotal(userId, monthDate))
    }))
  );
};

export const getWeeklyTrend = async (userId) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 42);

  const data = await Expense.aggregate([
    {
      $match: {
        user_id: userId,
        date: { $gte: cutoff }
      }
    },
    {
      $group: {
        _id: {
          year: { $isoWeekYear: "$date" },
          week: { $isoWeek: "$date" }
        },
        total: { $sum: "$amount" }
      }
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.week": 1
      }
    }
  ]);

  return data.map((item) => ({
    label: `${item._id.year}-W${String(item._id.week).padStart(2, "0")}`,
    total: toCurrency(item.total)
  }));
};

export const getRecentTransactions = async (userId, limit = 5) =>
  Expense.find({ user_id: userId })
    .sort({ date: -1, created_at: -1 })
    .limit(limit)
    .lean();

export const getInvestmentAllocation = async (userId) => {
  const data = await Investment.aggregate([
    {
      $match: {
        user_id: userId
      }
    },
    {
      $group: {
        _id: "$assetType",
        total: { $sum: "$currentValue" }
      }
    },
    { $sort: { total: -1 } }
  ]);

  return data.map((item) => ({
    assetType: item._id,
    total: toCurrency(item.total)
  }));
};

export const getLoanBreakdown = async (userId) => {
  const data = await Loan.aggregate([
    {
      $match: {
        user_id: userId,
        status: { $ne: "closed" }
      }
    },
    {
      $group: {
        _id: "$loanType",
        total: { $sum: "$outstandingAmount" }
      }
    },
    { $sort: { total: -1 } }
  ]);

  return data.map((item) => ({
    loanType: item._id,
    total: toCurrency(item.total)
  }));
};

export const getDashboardSnapshot = async (userId) => {
  const currentMonth = formatMonthKey(new Date());

  const [
    budgetSnapshot,
    totalExpense,
    categoryBreakdown,
    monthlyTrend,
    weeklyTrend,
    recentTransactions,
    user,
    goals,
    investments,
    loans,
    investmentAllocation,
    loanBreakdown
  ] = await Promise.all([
    getBudgetSnapshot(userId, currentMonth),
    getMonthlyExpenseTotal(userId, new Date()),
    getCategoryBreakdown(userId, new Date()),
    getMonthlySpendingTrend(userId),
    getWeeklyTrend(userId),
    getRecentTransactions(userId, 8),
    User.findOne({ user_id: userId }).lean(),
    InvestmentGoal.find({ user_id: userId, status: { $ne: "completed" } })
      .sort({ targetDate: 1 })
      .limit(4)
      .lean(),
    Investment.find({ user_id: userId }).sort({ currentValue: -1 }).limit(6).lean(),
    Loan.find({ user_id: userId }).sort({ nextDueDate: 1 }).limit(6).lean(),
    getInvestmentAllocation(userId),
    getLoanBreakdown(userId)
  ]);

  const monthlyBudget = budgetSnapshot.monthlyBudget;
  const remainingBudget = monthlyBudget - totalExpense;
  const budgetUsage = monthlyBudget ? Number(((totalExpense / monthlyBudget) * 100).toFixed(1)) : 0;
  const portfolioValue = sumBy(investments, (item) => item.currentValue);
  const investedPrincipal = sumBy(investments, (item) => item.amountInvested);
  const unrealizedGain = portfolioValue - investedPrincipal;
  const outstandingLoans = sumBy(loans, (item) =>
    item.status === "closed" ? 0 : item.outstandingAmount
  );
  const monthlyEmi = sumBy(loans, (item) => (item.status === "closed" ? 0 : item.emi));
  const goalTarget = sumBy(goals, (item) => item.targetAmount);
  const goalCurrent = sumBy(goals, (item) => item.currentAmount);
  const activeGoals = goals.map((goal) => ({
    ...goal,
    progress: goal.targetAmount ? Number(((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)) : 0
  }));

  return {
    overview: {
      totalExpense: toCurrency(totalExpense),
      monthlyBudget: toCurrency(monthlyBudget),
      remainingBudget: toCurrency(remainingBudget),
      budgetUsage,
      portfolioValue: toCurrency(portfolioValue),
      investedPrincipal: toCurrency(investedPrincipal),
      unrealizedGain: toCurrency(unrealizedGain),
      outstandingLoans: toCurrency(outstandingLoans),
      netWorth: toCurrency(portfolioValue - outstandingLoans),
      monthlyEmi: toCurrency(monthlyEmi),
      goalFundingProgress: goalTarget ? Number(((goalCurrent / goalTarget) * 100).toFixed(1)) : 0
    },
    charts: {
      monthlyTrend,
      weeklyTrend,
      categoryBreakdown,
      investmentAllocation,
      loanBreakdown
    },
    lists: {
      recentTransactions,
      activeGoals,
      topInvestments: investments,
      activeLoans: loans
    },
    profile: user
      ? {
          full_name: user.full_name,
          email: user.email,
          preferred_currency: user.preferred_currency,
          monthly_income: user.monthly_income,
          target_savings: user.target_savings,
          risk_profile: user.risk_profile
        }
      : null,
    categoryBudgets: budgetSnapshot.categoryBudgets
  };
};

export const buildFinanceSummary = async (userId) => {
  const currentMonth = formatMonthKey(new Date());
  const [budgetSnapshot, totalExpense, categoryBreakdown, recentTransactions, goals, loans] =
    await Promise.all([
      getBudgetSnapshot(userId, currentMonth),
      getMonthlyExpenseTotal(userId, new Date()),
      getCategoryBreakdown(userId, new Date()),
      getRecentTransactions(userId, 5),
      InvestmentGoal.find({ user_id: userId, status: "active" }).lean(),
      Loan.find({ user_id: userId, status: { $ne: "closed" } }).lean()
    ]);

  const remainingBudget = budgetSnapshot.monthlyBudget - totalExpense;
  const usagePct = budgetSnapshot.monthlyBudget
    ? (totalExpense / budgetSnapshot.monthlyBudget) * 100
    : 0;

  const alerts = [];
  if (budgetSnapshot.monthlyBudget > 0 && usagePct >= budgetSnapshot.alertThreshold) {
    alerts.push(`Monthly budget usage is at ${usagePct.toFixed(1)}%`);
  }
  if (remainingBudget < 0) {
    alerts.push(`You are over budget by ${Math.abs(remainingBudget).toFixed(2)}`);
  }
  if (loans.some((loan) => loan.nextDueDate && new Date(loan.nextDueDate) < new Date(Date.now() + 7 * 86400000))) {
    alerts.push("At least one loan payment is due within 7 days");
  }

  const topCategories = categoryBreakdown.slice(0, 5);
  const insights = [];
  if (topCategories[0]) {
    insights.push(
      `${topCategories[0].category} is your top spending category this month at ${topCategories[0].total.toFixed(2)}`
    );
  }
  if (budgetSnapshot.monthlyBudget > 0) {
    insights.push(
      `You have used ${usagePct.toFixed(1)}% of your ${budgetSnapshot.monthlyBudget.toFixed(2)} monthly budget`
    );
  }
  if (goals.length > 0) {
    insights.push(`${goals.length} investment goals are currently active in your finance plan`);
  }

  const recommendations = [];
  if (topCategories[0] && topCategories[0].total > totalExpense * 0.35) {
    recommendations.push(`Review ${topCategories[0].category} spending for possible savings`);
  }
  if (remainingBudget > 0 && budgetSnapshot.monthlyBudget > 0) {
    recommendations.push(`You can still spend ${remainingBudget.toFixed(2)} and remain within budget`);
  }
  if (loans.length > 0) {
    recommendations.push("Prioritize high-interest loans before increasing high-risk investments");
  }

  return {
    module: "finance",
    data: {
      total_expense: toCurrency(totalExpense),
      monthly_budget: toCurrency(budgetSnapshot.monthlyBudget),
      remaining_budget: toCurrency(remainingBudget),
      top_categories: topCategories,
      alerts,
      recent_transactions: recentTransactions.map((expense) => ({
        id: expense._id,
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        date: expense.date
      }))
    },
    insights,
    recommendations
  };
};
