import { Budget } from "../models/Budget.js";
import { Expense } from "../models/Expense.js";
import { InvestmentGoal } from "../models/InvestmentGoal.js";
import { Investment } from "../models/Investment.js";
import { InvestmentNewsletter } from "../models/InvestmentNewsletter.js";
import { Loan } from "../models/Loan.js";
import { PortfolioPlan } from "../models/PortfolioPlan.js";
import { User } from "../models/User.js";
import { formatMonthKey, getLastMonths, getMonthRange } from "../utils.js";
import {
  buildPortfolioRecommendation,
  buildRebalancingView,
  calculateCurrentAllocation
} from "./portfolioAdvisorService.js";

const toCurrency = (value) => Number(Number(value || 0).toFixed(2));
const clamp = (value, minimum = 0, maximum = 100) => Math.min(Math.max(value, minimum), maximum);

const scoreStatus = (score) => (score >= 80 ? "strong" : score >= 60 ? "stable" : score >= 40 ? "attention" : "critical");

const monthsUntil = (date) => Math.max(
  1,
  Math.ceil((new Date(date).getTime() - Date.now()) / (30.4375 * 86400000))
);

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
  const firstMonth = months[0];
  const data = await Expense.aggregate([
    { $match: { user_id: userId, date: { $gte: firstMonth } } },
    {
      $group: {
        _id: { year: { $year: "$date" }, month: { $month: "$date" } },
        total: { $sum: "$amount" }
      }
    }
  ]);
  const totals = new Map(
    data.map((item) => [
      `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      toCurrency(item.total)
    ])
  );

  return months.map((monthDate) => {
    const month = formatMonthKey(monthDate);
    return { month, total: totals.get(month) || 0 };
  });
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

export const getPortfolioTotals = async (userId) => {
  const data = await Investment.aggregate([
    { $match: { user_id: userId } },
    {
      $group: {
        _id: null,
        portfolioValue: { $sum: "$currentValue" },
        investedPrincipal: { $sum: "$amountInvested" },
        count: { $sum: 1 }
      }
    }
  ]);
  return data[0] || { portfolioValue: 0, investedPrincipal: 0, count: 0 };
};

export const getLoanTotals = async (userId) => {
  const data = await Loan.aggregate([
    { $match: { user_id: userId, status: { $ne: "closed" } } },
    {
      $group: {
        _id: null,
        outstandingLoans: { $sum: "$outstandingAmount" },
        monthlyEmi: { $sum: "$emi" },
        count: { $sum: 1 }
      }
    }
  ]);
  return data[0] || { outstandingLoans: 0, monthlyEmi: 0, count: 0 };
};

export const getGoalTotals = async (userId) => {
  const data = await InvestmentGoal.aggregate([
    { $match: { user_id: userId, status: { $ne: "completed" } } },
    {
      $group: {
        _id: null,
        targetAmount: { $sum: "$targetAmount" },
        currentAmount: { $sum: "$currentAmount" },
        count: { $sum: 1 }
      }
    }
  ]);
  return data[0] || { targetAmount: 0, currentAmount: 0, count: 0 };
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
    portfolioPlan,
    goals,
    investments,
    loans,
    investmentAllocation,
    loanBreakdown,
    portfolioTotals,
    loanTotals,
    goalTotals
  ] = await Promise.all([
    getBudgetSnapshot(userId, currentMonth),
    getMonthlyExpenseTotal(userId, new Date()),
    getCategoryBreakdown(userId, new Date()),
    getMonthlySpendingTrend(userId),
    getWeeklyTrend(userId),
    getRecentTransactions(userId, 8),
    User.findOne({ user_id: userId }).lean(),
    PortfolioPlan.findOne({ user_id: userId }).lean(),
    InvestmentGoal.find({ user_id: userId, status: { $ne: "completed" } })
      .sort({ targetDate: 1 })
      .limit(4)
      .lean(),
    Investment.find({ user_id: userId }).sort({ currentValue: -1 }).limit(6).lean(),
    Loan.find({ user_id: userId, status: { $ne: "closed" } })
      .sort({ nextDueDate: 1 })
      .limit(6)
      .lean(),
    getInvestmentAllocation(userId),
    getLoanBreakdown(userId),
    getPortfolioTotals(userId),
    getLoanTotals(userId),
    getGoalTotals(userId)
  ]);

  const monthlyBudget = budgetSnapshot.monthlyBudget;
  const remainingBudget = monthlyBudget - totalExpense;
  const budgetUsage = monthlyBudget ? Number(((totalExpense / monthlyBudget) * 100).toFixed(1)) : 0;
  const portfolioValue = portfolioTotals.portfolioValue;
  const liquidSavings = Number(portfolioPlan?.questionnaire?.liquidSavings || 0);
  const totalAssets = portfolioValue + liquidSavings;
  const investedPrincipal = portfolioTotals.investedPrincipal;
  const unrealizedGain = portfolioValue - investedPrincipal;
  const outstandingLoans = loanTotals.outstandingLoans;
  const monthlyEmi = loanTotals.monthlyEmi;
  const goalTarget = goalTotals.targetAmount;
  const goalCurrent = goalTotals.currentAmount;
  const activeGoals = goals.map((goal) => ({
    ...goal,
    progress: goal.targetAmount ? Number(((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)) : 0
  }));

  return {
    overview: {
      totalExpense: toCurrency(totalExpense),
      monthlyBudget: toCurrency(monthlyBudget),
      budgetMonth: currentMonth,
      budgetAlertThreshold: budgetSnapshot.alertThreshold,
      remainingBudget: toCurrency(remainingBudget),
      budgetUsage,
      portfolioValue: toCurrency(portfolioValue),
      liquidSavings: toCurrency(liquidSavings),
      totalAssets: toCurrency(totalAssets),
      investedPrincipal: toCurrency(investedPrincipal),
      unrealizedGain: toCurrency(unrealizedGain),
      outstandingLoans: toCurrency(outstandingLoans),
      netWorth: toCurrency(totalAssets - outstandingLoans),
      monthlyEmi: toCurrency(monthlyEmi),
      goalFundingProgress: goalTarget ? Number(((goalCurrent / goalTarget) * 100).toFixed(1)) : 0,
      investmentCount: portfolioTotals.count,
      activeLoanCount: loanTotals.count,
      activeGoalCount: goalTotals.count
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

export const buildFinancialAssessment = ({
  profile,
  plan,
  budgetSnapshot,
  currentMonthExpenses,
  monthlyExpenseTotals,
  classification,
  investments,
  loans,
  goals
}) => {
  const monthlyIncome = Number(profile?.monthly_income || plan?.questionnaire?.monthlyIncome || 0);
  const averageMonthlyExpenses = monthlyExpenseTotals.length
    ? monthlyExpenseTotals.reduce((sum, item) => sum + item.total, 0) / monthlyExpenseTotals.length
    : 0;
  const activeLoans = loans.filter((loan) => loan.status !== "closed");
  const monthlyDebtPayments = activeLoans.reduce((sum, loan) => sum + Number(loan.emi || 0), 0);
  const outstandingDebt = activeLoans.reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0);
  const portfolioValue = investments.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  const investedPrincipal = investments.reduce((sum, item) => sum + Number(item.amountInvested || 0), 0);
  const liquidSavings = Number(plan?.questionnaire?.liquidSavings || 0);
  const estimatedMonthlySurplus = monthlyIncome - averageMonthlyExpenses - monthlyDebtPayments;
  const savingsRate = monthlyIncome ? (estimatedMonthlySurplus / monthlyIncome) * 100 : 0;
  const debtToIncome = monthlyIncome ? (monthlyDebtPayments / monthlyIncome) * 100 : 0;
  const budgetUsage = budgetSnapshot.monthlyBudget
    ? (currentMonthExpenses / budgetSnapshot.monthlyBudget) * 100
    : 0;
  const classifiedTotal = classification.reduce((sum, item) => sum + item.total, 0);
  const discretionaryTotal = classification
    .filter((item) => ["wants", "luxury"].includes(item.type))
    .reduce((sum, item) => sum + item.total, 0);
  const potentialSavings = classification.reduce((sum, item) => sum + item.potentialSavings, 0);
  const discretionaryRate = classifiedTotal ? (discretionaryTotal / classifiedTotal) * 100 : 0;
  const activeGoals = goals.filter((goal) => !["completed", "paused"].includes(goal.status));
  const goalTarget = activeGoals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0);
  const goalCurrent = activeGoals.reduce((sum, goal) => sum + Number(goal.currentAmount || 0), 0);
  const goalFunding = goalTarget ? clamp((goalCurrent / goalTarget) * 100) : 0;
  const currentAllocation = plan ? calculateCurrentAllocation(investments, liquidSavings) : null;
  const rebalancing = plan
    ? buildRebalancingView(currentAllocation, plan.recommendedAllocation)
    : [];
  const allocationDistance = rebalancing.reduce(
    (sum, item) => sum + Math.abs(item.differencePercentage),
    0
  ) / 2;

  const emergencyFunded = plan?.emergencyFund?.fundedPercentage ?? 0;
  const cashFlowScore = monthlyIncome ? clamp((savingsRate / 20) * 100) : 0;
  const emergencyScore = clamp(emergencyFunded);
  const debtScore = monthlyIncome ? clamp(100 - Math.max(debtToIncome - 10, 0) * 3) : 35;
  const spendingScore = budgetSnapshot.monthlyBudget
    ? clamp(budgetUsage <= 80 ? 100 : 100 - (budgetUsage - 80) * 2.5)
    : 50;
  const goalScore = activeGoals.length ? clamp(goalFunding) : 55;
  const portfolioScore = plan ? clamp(100 - allocationDistance * 2) : 45;
  const dimensions = [
    { key: "cashFlow", label: "Cash flow", score: Math.round(cashFlowScore), explanation: `Estimated savings rate is ${savingsRate.toFixed(1)}%.` },
    { key: "emergency", label: "Emergency readiness", score: Math.round(emergencyScore), explanation: plan ? `Emergency reserve is ${emergencyFunded.toFixed(1)}% funded.` : "Complete the risk questionnaire to calculate the reserve target." },
    { key: "debt", label: "Debt load", score: Math.round(debtScore), explanation: `Monthly debt payments use ${debtToIncome.toFixed(1)}% of income.` },
    { key: "spending", label: "Spending control", score: Math.round(spendingScore), explanation: budgetSnapshot.monthlyBudget ? `Current budget usage is ${budgetUsage.toFixed(1)}%.` : "No overall monthly budget has been set." },
    { key: "goals", label: "Goal progress", score: Math.round(goalScore), explanation: activeGoals.length ? `Active goals are ${goalFunding.toFixed(1)}% funded.` : "No active financial goal is recorded." },
    { key: "portfolio", label: "Portfolio alignment", score: Math.round(portfolioScore), explanation: plan ? `Allocation is ${allocationDistance.toFixed(1)} percentage points from the target mix.` : "Complete the risk questionnaire to establish a target allocation." }
  ].map((item) => ({ ...item, status: scoreStatus(item.score) }));
  const healthScore = Math.round(
    cashFlowScore * 0.25 + emergencyScore * 0.2 + debtScore * 0.2 +
    spendingScore * 0.15 + goalScore * 0.1 + portfolioScore * 0.1
  );
  const healthBand = healthScore >= 80 ? "strong" : healthScore >= 65 ? "stable" : healthScore >= 50 ? "needs_attention" : "vulnerable";

  const actions = [];
  const addAction = (action) => actions.push(action);
  if (!monthlyIncome) {
    addAction({ id: "add-income", priority: "urgent", category: "profile", title: "Add your monthly income", recommendation: "Complete the income field in your financial profile so cash-flow and debt guidance can be calculated.", reason: "Income is the baseline for affordability and savings-rate calculations.", suggestedMonthlyAmount: 0 });
  }
  if (!budgetSnapshot.monthlyBudget) {
    addAction({ id: "set-budget", priority: "high", category: "spending", title: "Set an overall monthly budget", recommendation: monthlyIncome ? `Start with a ceiling near ${toCurrency(monthlyIncome * 0.7)} and refine it after one complete month of tracking.` : "Set a realistic overall limit after recording income.", reason: "A budget provides an early warning before spending reduces goal contributions.", suggestedMonthlyAmount: 0 });
  } else if (budgetUsage > 100) {
    addAction({ id: "budget-overrun", priority: "urgent", category: "spending", title: "Bring spending back within budget", recommendation: `Current spending is ${toCurrency(currentMonthExpenses - budgetSnapshot.monthlyBudget)} above the monthly limit. Review the largest discretionary categories first.`, reason: `Budget usage has reached ${budgetUsage.toFixed(1)}%.`, suggestedMonthlyAmount: toCurrency(currentMonthExpenses - budgetSnapshot.monthlyBudget) });
  }
  if (monthlyIncome && savingsRate < 10) {
    const target = Math.max(monthlyIncome * 0.15 - Math.max(estimatedMonthlySurplus, 0), 0);
    addAction({ id: "cash-flow", priority: savingsRate < 0 ? "urgent" : "high", category: "cash_flow", title: savingsRate < 0 ? "Repair the monthly cash-flow deficit" : "Raise the monthly savings rate", recommendation: `Redirect approximately ${toCurrency(target)} per month toward savings by reducing discretionary expenses or increasing income.`, reason: `The estimated savings rate is ${savingsRate.toFixed(1)}%; a 15% initial target would provide more resilience.`, suggestedMonthlyAmount: toCurrency(target) });
  }
  if (plan?.emergencyFund?.gap > 0) {
    const emergencyContribution = Math.min(
      plan.emergencyFund.gap,
      Math.max(estimatedMonthlySurplus * 0.5, plan.emergencyFund.gap / 18, 0)
    );
    addAction({ id: "emergency-fund", priority: emergencyFunded < 50 ? "urgent" : "high", category: "safety", title: "Close the emergency-fund gap", recommendation: `Keep this money in accessible, low-volatility accounts and contribute about ${toCurrency(emergencyContribution)} monthly until the reserve reaches ${toCurrency(plan.emergencyFund.targetAmount)}.`, reason: `The reserve is ${emergencyFunded.toFixed(1)}% funded with a ${toCurrency(plan.emergencyFund.gap)} gap.`, suggestedMonthlyAmount: toCurrency(emergencyContribution) });
  }
  const expensiveLoan = [...activeLoans].sort((a, b) => b.interestRate - a.interestRate)[0];
  if (expensiveLoan && (expensiveLoan.interestRate >= 12 || debtToIncome > 30)) {
    const extraPayment = Math.max(Math.min(Math.max(estimatedMonthlySurplus, 0) * 0.35, expensiveLoan.outstandingAmount), 0);
    addAction({ id: "high-cost-debt", priority: debtToIncome > 40 ? "urgent" : "high", category: "debt", title: `Prioritize the ${expensiveLoan.loanType} loan`, recommendation: `After minimum payments and essential reserves, direct about ${toCurrency(extraPayment)} extra per month to the highest-rate balance.`, reason: `${expensiveLoan.lender} is charging ${Number(expensiveLoan.interestRate).toFixed(1)}%, and total EMIs use ${debtToIncome.toFixed(1)}% of income.`, suggestedMonthlyAmount: toCurrency(extraPayment) });
  }
  if (potentialSavings > 0 && discretionaryRate >= 20) {
    addAction({ id: "avoidable-spending", priority: discretionaryRate >= 35 ? "high" : "medium", category: "spending", title: "Capture avoidable spending", recommendation: `Set an automatic transfer of up to ${toCurrency(potentialSavings)} based on the wants and luxury spending identified in your history.`, reason: `${discretionaryRate.toFixed(1)}% of classified spending is discretionary.`, suggestedMonthlyAmount: toCurrency(potentialSavings) });
  }
  for (const goal of activeGoals) {
    const required = Math.max((goal.targetAmount - goal.currentAmount) / monthsUntil(goal.targetDate), 0);
    if (required > Number(goal.monthlyContribution || 0) * 1.1) {
      addAction({ id: `goal-${goal._id}`, priority: goal.priority === "high" ? "high" : "medium", category: "goals", title: `Increase funding for ${goal.title}`, recommendation: `The straight-line contribution is about ${toCurrency(required)} per month; the recorded contribution is ${toCurrency(goal.monthlyContribution)}.`, reason: `The goal has ${monthsUntil(goal.targetDate)} months remaining and ${toCurrency(goal.targetAmount - goal.currentAmount)} left to fund.`, suggestedMonthlyAmount: toCurrency(Math.max(required - goal.monthlyContribution, 0)) });
    }
  }
  const largestGap = [...rebalancing].sort((a, b) => b.differencePercentage - a.differencePercentage)[0];
  if (largestGap?.differencePercentage > 7) {
    addAction({ id: "portfolio-gap", priority: "medium", category: "portfolio", title: `Direct new investments toward ${largestGap.bucket}`, recommendation: `Use new contributions to move from ${largestGap.currentPercentage}% toward the ${largestGap.targetPercentage}% educational target before considering sales.`, reason: `This bucket is under target by ${largestGap.differencePercentage.toFixed(1)} percentage points.`, suggestedMonthlyAmount: toCurrency(Math.max(estimatedMonthlySurplus, 0) * 0.3) });
  }
  for (const warning of plan?.warnings || []) {
    if (/insurance/i.test(warning)) {
      addAction({ id: `protection-${actions.length}`, priority: "high", category: "protection", title: "Review protection coverage", recommendation: warning, reason: "Insurance gaps can force long-term assets to be sold during an emergency.", suggestedMonthlyAmount: 0 });
    }
  }
  if (!plan) {
    addAction({ id: "questionnaire", priority: "high", category: "portfolio", title: "Complete the risk and liquidity questionnaire", recommendation: "Provide horizon, dependents, insurance, liquidity, experience, and risk preferences to generate an allocation target.", reason: "Portfolio advice without capacity and time-horizon data would be unreliable.", suggestedMonthlyAmount: 0 });
  }
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const completenessChecks = [
    { key: "profile", label: "Income profile", complete: monthlyIncome > 0 },
    { key: "expenses", label: "Expense history", complete: monthlyExpenseTotals.length > 0 },
    { key: "budget", label: "Monthly budget", complete: budgetSnapshot.monthlyBudget > 0 },
    { key: "portfolio", label: "Investments", complete: investments.length > 0 },
    { key: "goals", label: "Financial goals", complete: goals.length > 0 },
    { key: "risk", label: "Risk questionnaire", complete: Boolean(plan) }
  ];
  const completeness = Math.round(
    (completenessChecks.filter((item) => item.complete).length / completenessChecks.length) * 100
  );

  return {
    generatedAt: new Date(),
    health: { score: healthScore, band: healthBand, dimensions },
    snapshot: {
      monthlyIncome: toCurrency(monthlyIncome),
      averageMonthlyExpenses: toCurrency(averageMonthlyExpenses),
      currentMonthExpenses: toCurrency(currentMonthExpenses),
      monthlyDebtPayments: toCurrency(monthlyDebtPayments),
      estimatedMonthlySurplus: toCurrency(estimatedMonthlySurplus),
      estimatedSavingsRate: Number(savingsRate.toFixed(1)),
      monthlyBudget: toCurrency(budgetSnapshot.monthlyBudget),
      budgetUsage: Number(budgetUsage.toFixed(1)),
      portfolioValue: toCurrency(portfolioValue),
      investedPrincipal: toCurrency(investedPrincipal),
      unrealizedGain: toCurrency(portfolioValue - investedPrincipal),
      liquidSavings: toCurrency(liquidSavings),
      outstandingDebt: toCurrency(outstandingDebt),
      debtToIncome: Number(debtToIncome.toFixed(1)),
      goalFundingPercentage: Number(goalFunding.toFixed(1)),
      discretionarySpendingPercentage: Number(discretionaryRate.toFixed(1)),
      potentialMonthlySavings: toCurrency(potentialSavings)
    },
    actions: actions.slice(0, 10),
    portfolio: plan ? {
      riskScore: plan.riskScore,
      riskBand: plan.riskBand,
      target: plan.recommendedAllocation,
      current: currentAllocation,
      rebalancing
    } : null,
    dataCompleteness: { percentage: completeness, checks: completenessChecks },
    assumptions: [
      "Cash flow uses the average of recorded monthly expenses and current active-loan EMIs.",
      "Potential savings uses 50% of wants and 80% of luxury spending.",
      "Goal contribution estimates are straight-line amounts and do not promise investment returns."
    ],
    disclaimer: "This automated assessment is educational and based only on the records supplied. It is not a substitute for advice from a SEBI-registered investment adviser, tax professional, or insurance specialist."
  };
};

export const getFinancialAssessment = async (userId) => {
  const currentMonth = formatMonthKey(new Date());
  const threeMonthStart = new Date();
  threeMonthStart.setDate(1);
  threeMonthStart.setMonth(threeMonthStart.getMonth() - 2);
  threeMonthStart.setHours(0, 0, 0, 0);
  const [
    profile,
    plan,
    budgetSnapshot,
    currentMonthExpenses,
    expenseAnalytics,
    investments,
    loans,
    goals
  ] = await Promise.all([
    User.findOne({ user_id: userId }).lean(),
    PortfolioPlan.findOne({ user_id: userId }).lean(),
    getBudgetSnapshot(userId, currentMonth),
    getMonthlyExpenseTotal(userId, new Date()),
    Expense.aggregate([
      { $match: { user_id: userId, date: { $gte: threeMonthStart } } },
      {
        $facet: {
          months: [
            { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" } }, total: { $sum: "$amount" } } },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
          ],
          classification: [
            { $group: { _id: { $ifNull: ["$necessityType", "uncategorized"] }, total: { $sum: "$amount" }, potentialSavings: { $sum: { $ifNull: ["$potentialSavings", 0] } } } }
          ]
        }
      }
    ]),
    Investment.find({ user_id: userId }).lean(),
    Loan.find({ user_id: userId }).lean(),
    InvestmentGoal.find({ user_id: userId }).lean()
  ]);
  const facets = expenseAnalytics[0] || { months: [], classification: [] };
  return buildFinancialAssessment({
    profile,
    plan,
    budgetSnapshot,
    currentMonthExpenses,
    monthlyExpenseTotals: facets.months.map((item) => ({ total: Number(item.total || 0) })),
    classification: facets.classification.map((item) => ({
      type: item._id,
      total: Number(item.total || 0),
      potentialSavings: Number(item.potentialSavings || 0)
    })),
    investments,
    loans,
    goals
  });
};

export const ensureDemoWorkspace = async (userId = "resume-demo-user") => {
  const now = new Date();
  const month = formatMonthKey(now);
  const dateInMonth = (day) => new Date(now.getFullYear(), now.getMonth(), Math.min(day, now.getDate()));
  const daysFromNow = (days) => new Date(now.getTime() + days * 86400000);
  await Promise.all([
    User.findOneAndUpdate(
      { user_id: userId },
      { user_id: userId, email: "demo@finance.local", full_name: "Aarav Mehta", preferred_currency: "INR", monthly_income: 120000, target_savings: 30000, risk_profile: "moderate", occupation: "Product Designer", city: "Bengaluru" },
      { upsert: true, runValidators: true }
    ),
    Budget.findOneAndUpdate(
      { user_id: userId, category: "overall", month },
      { user_id: userId, category: "overall", month, amount: 65000, alertThreshold: 80 },
      { upsert: true, runValidators: true }
    )
  ]);
  const expenses = [
    { amount: 18500, category: "Housing", description: "Monthly rent", date: dateInMonth(2), recurring: true, necessityType: "needs", potentialSavings: 0 },
    { amount: 5400, category: "Groceries", description: "Weekly groceries", date: dateInMonth(8), necessityType: "needs", potentialSavings: 0 },
    { amount: 2200, category: "Transport", description: "Office commute", date: dateInMonth(12), necessityType: "needs", potentialSavings: 0 },
    { amount: 1800, category: "Dining", description: "Weekend restaurant", date: dateInMonth(14), necessityType: "wants", potentialSavings: 900 },
    { amount: 4200, category: "Luxury shopping", description: "Premium fashion purchase", date: dateInMonth(16), necessityType: "luxury", potentialSavings: 3360 }
  ];
  const investments = [
    { assetName: "Nifty Index Fund", assetType: "Equity Mutual Fund", symbol: "NIFTYBEES", amountInvested: 180000, currentValue: 205000, units: 500, riskLevel: "high" },
    { assetName: "Short Duration Fund", assetType: "Debt Mutual Fund", amountInvested: 90000, currentValue: 95000, units: 800, riskLevel: "low" },
    { assetName: "Gold ETF", assetType: "Gold ETF", symbol: "GOLDBEES", amountInvested: 45000, currentValue: 51000, units: 80, riskLevel: "moderate" }
  ];
  await Promise.all([
    ...expenses.map((expense) => Expense.findOneAndUpdate(
      { user_id: userId, description: expense.description, date: expense.date },
      { user_id: userId, tags: ["demo"], notes: "Demonstration data", recurring: false, classificationSource: "user_review", ...expense },
      { upsert: true, runValidators: true }
    )),
    ...investments.map((investment) => Investment.findOneAndUpdate(
      { user_id: userId, assetName: investment.assetName },
      { user_id: userId, platform: "Demo Broker", purchaseDate: daysFromNow(-365), notes: "Demonstration data", ...investment },
      { upsert: true, runValidators: true }
    )),
    InvestmentGoal.findOneAndUpdate(
      { user_id: userId, title: "Home down payment" },
      { user_id: userId, title: "Home down payment", goalType: "property", targetAmount: 1500000, currentAmount: 260000, monthlyContribution: 25000, expectedReturn: 8, priority: "high", targetDate: daysFromNow(1460), status: "active" },
      { upsert: true, runValidators: true }
    ),
    Loan.findOneAndUpdate(
      { user_id: userId, lender: "Demo Bank", loanType: "Education" },
      { user_id: userId, lender: "Demo Bank", loanType: "Education", principalAmount: 400000, outstandingAmount: 185000, emi: 9200, interestRate: 13.2, tenureMonths: 24, nextDueDate: daysFromNow(5), status: "active" },
      { upsert: true, runValidators: true }
    )
  ]);
  const questionnaire = {
    age: 31,
    dependents: 1,
    monthlyIncome: 120000,
    monthlyEssentialExpenses: 50000,
    monthlyDebtPayments: 9200,
    liquidSavings: 180000,
    investmentHorizonYears: 10,
    riskTolerance: "balanced",
    incomeStability: "stable",
    investmentExperience: "intermediate",
    hasHealthInsurance: true,
    hasTermInsurance: false,
    goals: ["Home purchase", "Retirement"],
    preferredRealEstateAllocation: 10
  };
  const recommendation = buildPortfolioRecommendation(questionnaire);
  await PortfolioPlan.findOneAndUpdate(
    { user_id: userId },
    { user_id: userId, questionnaire, ...recommendation },
    { upsert: true, runValidators: true }
  );
  await InvestmentNewsletter.deleteOne({ user_id: userId, newsletterKey: now.toISOString().slice(0, 10) });
};
