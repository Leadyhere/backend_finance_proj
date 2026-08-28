import mongoose from "mongoose";
import validator from "validator";
import { ApiError } from "../utils.js";

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const normalizeText = (value) => String(value ?? "").trim();

const requireText = (value, fieldName) => {
  const text = normalizeText(value);
  if (!text) throw new ApiError(400, `${fieldName} is required`);
  return text;
};

const parsePositiveNumber = (value, fieldName, allowZero = true) => {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    throw new ApiError(400, `${fieldName} must be a valid number`);
  }
  const numberValue = Number(value);
  const isValid = Number.isFinite(numberValue) && (allowZero ? numberValue >= 0 : numberValue > 0);
  if (!isValid) throw new ApiError(400, `${fieldName} must be a valid number`);
  return numberValue;
};

const parseInteger = (value, fieldName, minimum, maximum) => {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    throw new ApiError(400, `${fieldName} must be between ${minimum} and ${maximum}`);
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < minimum || numberValue > maximum) {
    throw new ApiError(400, `${fieldName} must be between ${minimum} and ${maximum}`);
  }
  return numberValue;
};

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDate = (value, fieldName) => {
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === null || normalized === undefined || normalized === "" || typeof normalized === "boolean") {
    throw new ApiError(400, `${fieldName} is invalid`);
  }
  const dateOnly = typeof normalized === "string" ? normalized.match(dateOnlyPattern) : null;
  const date = dateOnly ? new Date(`${normalized}T00:00:00.000Z`) : new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${fieldName} is invalid`);
  if (
    dateOnly &&
    (date.getUTCFullYear() !== Number(dateOnly[1]) ||
      date.getUTCMonth() + 1 !== Number(dateOnly[2]) ||
      date.getUTCDate() !== Number(dateOnly[3]))
  ) {
    throw new ApiError(400, `${fieldName} is invalid`);
  }
  return date;
};

export const parseQueryDate = (value, fieldName, { endOfDay = false, endExclusive = false } = {}) => {
  const date = parseDate(value, fieldName);
  if (typeof value === "string" && dateOnlyPattern.test(value.trim())) {
    if (endExclusive) date.setUTCDate(date.getUTCDate() + 1);
    else if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

export const parseBoolean = (value, fieldName) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  throw new ApiError(400, `${fieldName} must be a boolean`);
};

export const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const validateObjectId = (parameter = "id") => (req, _res, next) => {
  if (!mongoose.isValidObjectId(req.params[parameter])) {
    return next(new ApiError(400, `Invalid ${parameter}`));
  }
  return next();
};

export const normalizeExpensePayload = (body, { partial = false } = {}) => {
  if (!partial && (!body.category || !body.description || !body.date)) {
    throw new ApiError(400, "Category, description, and date are required");
  }
  const payload = {};
  if (!partial || has(body, "amount")) payload.amount = parsePositiveNumber(body.amount, "Amount", false);
  if (!partial || has(body, "category")) payload.category = requireText(body.category, "Category");
  if (!partial || has(body, "description")) payload.description = requireText(body.description, "Description");
  if (!partial || has(body, "tags")) {
    payload.tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => normalizeText(tag)).filter(Boolean).slice(0, 10)
      : [];
  }
  if (!partial || has(body, "notes")) payload.notes = body.notes ? normalizeText(body.notes) : "";
  if (!partial || has(body, "date")) payload.date = parseDate(body.date, "Expense date");
  if (!partial || has(body, "recurring")) payload.recurring = parseBoolean(body.recurring ?? false, "Recurring");
  if (!partial || has(body, "merchant")) payload.merchant = normalizeText(body.merchant);
  if (!partial || has(body, "necessityType")) {
    const necessityType = body.necessityType || "uncategorized";
    if (!["needs", "wants", "luxury", "uncategorized"].includes(necessityType)) {
      throw new ApiError(400, "Necessity type is invalid");
    }
    payload.necessityType = necessityType;
    payload.classificationSource = has(body, "necessityType") ? "user_review" : "manual";
    const savingsRate = { needs: 0, wants: 0.5, luxury: 0.8, uncategorized: 0 }[necessityType];
    payload.potentialSavings = Number(((payload.amount ?? Number(body.amount) ?? 0) * savingsRate).toFixed(2));
  }
  return payload;
};

export const normalizeBudgetPayload = (body) => {
  if (!body.month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(body.month))) {
    throw new ApiError(400, "Budget month must use YYYY-MM format");
  }
  const alertThreshold = Number(body.alertThreshold ?? 80);
  if (!Number.isFinite(alertThreshold) || alertThreshold < 1 || alertThreshold > 100) {
    throw new ApiError(400, "Alert threshold must be between 1 and 100");
  }
  return {
    amount: parsePositiveNumber(body.amount, "Budget amount"),
    category: body.category ? normalizeText(body.category) : "overall",
    month: String(body.month),
    alertThreshold
  };
};

export const normalizeProfilePayload = (body) => {
  const payload = {};
  if (has(body, "full_name")) payload.full_name = normalizeText(body.full_name);
  if (has(body, "phone")) payload.phone = normalizeText(body.phone);
  if (has(body, "preferred_currency")) {
    const currency = normalizeText(body.preferred_currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new ApiError(400, "Preferred currency must be a 3-letter code");
    payload.preferred_currency = currency;
  }
  if (has(body, "locale")) payload.locale = normalizeText(body.locale);
  if (has(body, "monthly_income")) payload.monthly_income = parsePositiveNumber(body.monthly_income, "Monthly income");
  if (has(body, "target_savings")) payload.target_savings = parsePositiveNumber(body.target_savings, "Target savings");
  if (has(body, "risk_profile")) {
    if (!["conservative", "moderate", "aggressive"].includes(body.risk_profile)) throw new ApiError(400, "Risk profile is invalid");
    payload.risk_profile = body.risk_profile;
  }
  if (has(body, "occupation")) payload.occupation = normalizeText(body.occupation);
  if (has(body, "city")) payload.city = normalizeText(body.city);
  if (has(body, "avatar_url")) {
    const avatarUrl = String(body.avatar_url || "").trim();
    if (avatarUrl && !validator.isURL(avatarUrl, { protocols: ["http", "https"], require_protocol: true })) {
      throw new ApiError(400, "Avatar URL is invalid");
    }
    payload.avatar_url = avatarUrl;
  }
  if (has(body, "notification_preferences")) {
    payload.notification_preferences = {};
    for (const key of ["budgetAlerts", "marketDigest", "billReminders"]) {
      if (has(body.notification_preferences || {}, key)) {
        payload.notification_preferences[key] = parseBoolean(body.notification_preferences[key], key);
      }
    }
  }
  return payload;
};

export const normalizeGoalPayload = (body, { partial = false } = {}) => {
  if (!partial && (!body.title || !body.targetDate)) throw new ApiError(400, "Title and target date are required");
  const payload = {};
  if (!partial || has(body, "title")) payload.title = requireText(body.title, "Title");
  if (!partial || has(body, "goalType")) payload.goalType = normalizeText(body.goalType || "wealth");
  if (!partial || has(body, "targetAmount")) payload.targetAmount = parsePositiveNumber(body.targetAmount, "Target amount", false);
  if (!partial || has(body, "currentAmount")) payload.currentAmount = parsePositiveNumber(body.currentAmount ?? 0, "Current amount");
  if (!partial || has(body, "monthlyContribution")) payload.monthlyContribution = parsePositiveNumber(body.monthlyContribution ?? 0, "Monthly contribution");
  if (!partial || has(body, "expectedReturn")) payload.expectedReturn = parsePositiveNumber(body.expectedReturn ?? 0, "Expected return");
  if (!partial || has(body, "priority")) {
    if (has(body, "priority") && !["low", "medium", "high"].includes(body.priority)) throw new ApiError(400, "Priority is invalid");
    payload.priority = body.priority || "medium";
  }
  if (!partial || has(body, "targetDate")) payload.targetDate = parseDate(body.targetDate, "Target date");
  if (!partial || has(body, "notes")) payload.notes = normalizeText(body.notes);
  if (!partial || has(body, "status")) {
    if (has(body, "status") && !["planned", "active", "completed", "paused"].includes(body.status)) throw new ApiError(400, "Goal status is invalid");
    payload.status = body.status || "active";
  }
  return payload;
};

export const normalizeInvestmentPayload = (body, { partial = false } = {}) => {
  if (!partial && (!body.assetName || !body.assetType || !body.purchaseDate)) {
    throw new ApiError(400, "Asset name, asset type, and purchase date are required");
  }
  const payload = {};
  if (!partial || has(body, "assetName")) payload.assetName = requireText(body.assetName, "Asset name");
  if (!partial || has(body, "assetType")) payload.assetType = requireText(body.assetType, "Asset type");
  if (!partial || has(body, "symbol")) payload.symbol = normalizeText(body.symbol);
  if (!partial || has(body, "platform")) payload.platform = normalizeText(body.platform);
  if (!partial || has(body, "amountInvested")) payload.amountInvested = parsePositiveNumber(body.amountInvested, "Amount invested");
  if (!partial || has(body, "currentValue")) payload.currentValue = parsePositiveNumber(body.currentValue, "Current value");
  if (!partial || has(body, "units")) payload.units = parsePositiveNumber(body.units ?? 0, "Units");
  if (!partial || has(body, "riskLevel")) {
    if (has(body, "riskLevel") && !["low", "moderate", "high"].includes(body.riskLevel)) throw new ApiError(400, "Risk level is invalid");
    payload.riskLevel = body.riskLevel || "moderate";
  }
  if (!partial || has(body, "purchaseDate")) payload.purchaseDate = parseDate(body.purchaseDate, "Purchase date");
  if (!partial || has(body, "notes")) payload.notes = normalizeText(body.notes);
  return payload;
};

export const normalizeLoanPayload = (body, { partial = false } = {}) => {
  if (!partial && (!body.lender || !body.loanType || !body.nextDueDate)) {
    throw new ApiError(400, "Lender, loan type, and next due date are required");
  }
  const payload = {};
  if (!partial || has(body, "lender")) payload.lender = requireText(body.lender, "Lender");
  if (!partial || has(body, "loanType")) payload.loanType = requireText(body.loanType, "Loan type");
  if (!partial || has(body, "principalAmount")) payload.principalAmount = parsePositiveNumber(body.principalAmount, "Principal amount", false);
  if (!partial || has(body, "outstandingAmount")) payload.outstandingAmount = parsePositiveNumber(body.outstandingAmount, "Outstanding amount");
  if (!partial || has(body, "emi")) payload.emi = parsePositiveNumber(body.emi, "EMI");
  if (!partial || has(body, "interestRate")) payload.interestRate = parsePositiveNumber(body.interestRate, "Interest rate");
  if (!partial || has(body, "tenureMonths")) payload.tenureMonths = parsePositiveNumber(body.tenureMonths ?? 0, "Tenure months");
  if (!partial || has(body, "nextDueDate")) payload.nextDueDate = parseDate(body.nextDueDate, "Next due date");
  if (!partial || has(body, "secured")) payload.secured = parseBoolean(body.secured ?? false, "Secured");
  if (!partial || has(body, "status")) {
    if (has(body, "status") && !["active", "closed", "delayed"].includes(body.status)) throw new ApiError(400, "Loan status is invalid");
    payload.status = body.status || "active";
  }
  if (!partial || has(body, "notes")) payload.notes = normalizeText(body.notes);
  return payload;
};

export const normalizePortfolioQuestionnaire = (body) => {
  const allowedRisk = ["conservative", "balanced", "growth"];
  const allowedStability = ["unstable", "variable", "stable"];
  const allowedExperience = ["beginner", "intermediate", "experienced"];
  if (!allowedRisk.includes(body.riskTolerance)) throw new ApiError(400, "Risk tolerance is invalid");
  if (!allowedStability.includes(body.incomeStability)) throw new ApiError(400, "Income stability is invalid");
  if (!allowedExperience.includes(body.investmentExperience)) throw new ApiError(400, "Investment experience is invalid");

  const preferredRealEstateAllocation = parsePositiveNumber(
    body.preferredRealEstateAllocation ?? 0,
    "Preferred real-estate allocation"
  );
  if (preferredRealEstateAllocation > 30) {
    throw new ApiError(400, "Preferred real-estate allocation cannot exceed 30%");
  }

  return {
    age: parseInteger(body.age, "Age", 18, 100),
    dependents: parseInteger(body.dependents ?? 0, "Dependents", 0, 20),
    monthlyIncome: parsePositiveNumber(body.monthlyIncome, "Monthly income", false),
    monthlyEssentialExpenses: parsePositiveNumber(body.monthlyEssentialExpenses, "Monthly essential expenses"),
    monthlyDebtPayments: parsePositiveNumber(body.monthlyDebtPayments ?? 0, "Monthly debt payments"),
    liquidSavings: parsePositiveNumber(body.liquidSavings ?? 0, "Liquid savings"),
    investmentHorizonYears: parseInteger(body.investmentHorizonYears, "Investment horizon", 1, 50),
    riskTolerance: body.riskTolerance,
    incomeStability: body.incomeStability,
    investmentExperience: body.investmentExperience,
    hasHealthInsurance: parseBoolean(body.hasHealthInsurance ?? false, "Health insurance"),
    hasTermInsurance: parseBoolean(body.hasTermInsurance ?? false, "Term insurance"),
    goals: Array.isArray(body.goals)
      ? body.goals.map((goal) => normalizeText(goal)).filter(Boolean).slice(0, 10)
      : [],
    preferredRealEstateAllocation
  };
};

export const normalizeInflationPayload = (body) => {
  const currentAmount = parsePositiveNumber(body.currentAmount, "Current amount", false);
  const years = parseInteger(body.years, "Projection years", 1, 60);
  const inflationRate = parsePositiveNumber(body.inflationRate, "Inflation rate");
  const expectedReturn = parsePositiveNumber(body.expectedReturn, "Expected return");
  if (currentAmount > 1e15) throw new ApiError(400, "Current amount is too large");
  if (inflationRate > 30) throw new ApiError(400, "Inflation rate cannot exceed 30%");
  if (expectedReturn > 50) throw new ApiError(400, "Expected return cannot exceed 50%");
  return {
    currentAmount,
    years,
    inflationRate,
    expectedReturn,
    saveAssumptions: has(body, "saveAssumptions")
      ? parseBoolean(body.saveAssumptions, "Save assumptions")
      : true
  };
};
