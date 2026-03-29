import validator from "validator";
import { ApiError } from "../utils/ApiError.js";

const escapeText = (value) => validator.escape(String(value ?? "").trim());

const parsePositiveNumber = (value, fieldName, allowZero = true) => {
  const numberValue = Number(value);
  const isValid = Number.isFinite(numberValue) && (allowZero ? numberValue >= 0 : numberValue > 0);

  if (!isValid) {
    throw new ApiError(400, `${fieldName} must be a valid number`);
  }

  return numberValue;
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${fieldName} is invalid`);
  }

  return date;
};

export const normalizeExpensePayload = (body) => {
  if (!body.category || !body.description || !body.date) {
    throw new ApiError(400, "Category, description, and date are required");
  }

  return {
    amount: parsePositiveNumber(body.amount, "Amount", false),
    category: escapeText(body.category),
    description: escapeText(body.description),
    tags: Array.isArray(body.tags)
      ? body.tags.map((tag) => escapeText(tag)).filter(Boolean).slice(0, 10)
      : [],
    notes: body.notes ? escapeText(body.notes) : "",
    date: parseDate(body.date, "Expense date"),
    recurring: Boolean(body.recurring)
  };
};

export const normalizeBudgetPayload = (body) => {
  if (!body.month) {
    throw new ApiError(400, "Budget month is required");
  }

  const alertThreshold = Number(body.alertThreshold ?? 80);
  if (!Number.isFinite(alertThreshold) || alertThreshold < 1 || alertThreshold > 100) {
    throw new ApiError(400, "Alert threshold must be between 1 and 100");
  }

  return {
    amount: parsePositiveNumber(body.amount, "Budget amount"),
    category: body.category ? escapeText(body.category) : "overall",
    month: escapeText(body.month),
    alertThreshold
  };
};

export const normalizeProfilePayload = (body) => ({
  full_name: escapeText(body.full_name),
  phone: escapeText(body.phone),
  preferred_currency: escapeText(body.preferred_currency || "INR").toUpperCase(),
  locale: escapeText(body.locale || "en-IN"),
  monthly_income: parsePositiveNumber(body.monthly_income ?? 0, "Monthly income"),
  target_savings: parsePositiveNumber(body.target_savings ?? 0, "Target savings"),
  risk_profile: ["conservative", "moderate", "aggressive"].includes(body.risk_profile)
    ? body.risk_profile
    : "moderate",
  occupation: escapeText(body.occupation),
  city: escapeText(body.city),
  avatar_url: escapeText(body.avatar_url),
  notification_preferences: {
    budgetAlerts: body.notification_preferences?.budgetAlerts ?? true,
    marketDigest: body.notification_preferences?.marketDigest ?? true,
    billReminders: body.notification_preferences?.billReminders ?? true
  }
});

export const normalizeGoalPayload = (body) => {
  if (!body.title || !body.targetDate) {
    throw new ApiError(400, "Title and target date are required");
  }

  return {
    title: escapeText(body.title),
    goalType: escapeText(body.goalType || "wealth"),
    targetAmount: parsePositiveNumber(body.targetAmount, "Target amount"),
    currentAmount: parsePositiveNumber(body.currentAmount ?? 0, "Current amount"),
    monthlyContribution: parsePositiveNumber(
      body.monthlyContribution ?? 0,
      "Monthly contribution"
    ),
    expectedReturn: parsePositiveNumber(body.expectedReturn ?? 0, "Expected return"),
    priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
    targetDate: parseDate(body.targetDate, "Target date"),
    notes: escapeText(body.notes),
    status: ["planned", "active", "completed", "paused"].includes(body.status)
      ? body.status
      : "active"
  };
};

export const normalizeInvestmentPayload = (body) => {
  if (!body.assetName || !body.assetType || !body.purchaseDate) {
    throw new ApiError(400, "Asset name, asset type, and purchase date are required");
  }

  return {
    assetName: escapeText(body.assetName),
    assetType: escapeText(body.assetType),
    symbol: escapeText(body.symbol),
    platform: escapeText(body.platform),
    amountInvested: parsePositiveNumber(body.amountInvested, "Amount invested"),
    currentValue: parsePositiveNumber(body.currentValue, "Current value"),
    units: parsePositiveNumber(body.units ?? 0, "Units"),
    riskLevel: ["low", "moderate", "high"].includes(body.riskLevel)
      ? body.riskLevel
      : "moderate",
    purchaseDate: parseDate(body.purchaseDate, "Purchase date"),
    notes: escapeText(body.notes)
  };
};

export const normalizeLoanPayload = (body) => {
  if (!body.lender || !body.loanType || !body.nextDueDate) {
    throw new ApiError(400, "Lender, loan type, and next due date are required");
  }

  return {
    lender: escapeText(body.lender),
    loanType: escapeText(body.loanType),
    principalAmount: parsePositiveNumber(body.principalAmount, "Principal amount"),
    outstandingAmount: parsePositiveNumber(body.outstandingAmount, "Outstanding amount"),
    emi: parsePositiveNumber(body.emi, "EMI"),
    interestRate: parsePositiveNumber(body.interestRate, "Interest rate"),
    tenureMonths: parsePositiveNumber(body.tenureMonths ?? 0, "Tenure months"),
    nextDueDate: parseDate(body.nextDueDate, "Next due date"),
    secured: Boolean(body.secured),
    status: ["active", "closed", "delayed"].includes(body.status) ? body.status : "active",
    notes: escapeText(body.notes)
  };
};
