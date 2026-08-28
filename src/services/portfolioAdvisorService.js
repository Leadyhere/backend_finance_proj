import { Investment } from "../models/Investment.js";
import { InvestmentNewsletter } from "../models/InvestmentNewsletter.js";
import { PortfolioPlan } from "../models/PortfolioPlan.js";
import { getPortfolioNews } from "./marketService.js";

export const ADVISORY_DISCLAIMER =
  "This educational allocation is generated from the information provided and general diversification rules. It is not individualized investment, tax, legal, or insurance advice. Verify current facts and consult a SEBI-registered investment adviser before acting.";

const buckets = [
  "equityMutualFunds",
  "debtMutualFunds",
  "liquidAssets",
  "realEstateLand",
  "gold",
  "emergencyFund"
];

const baseAllocations = {
  conservative: { equityMutualFunds: 20, debtMutualFunds: 30, liquidAssets: 15, realEstateLand: 10, gold: 10, emergencyFund: 15 },
  balanced: { equityMutualFunds: 35, debtMutualFunds: 25, liquidAssets: 10, realEstateLand: 10, gold: 10, emergencyFund: 10 },
  growth: { equityMutualFunds: 50, debtMutualFunds: 20, liquidAssets: 8, realEstateLand: 10, gold: 7, emergencyFund: 5 }
};

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

const shift = (allocation, from, to, requestedAmount) => {
  const amount = Math.min(Math.max(requestedAmount, 0), allocation[from]);
  allocation[from] -= amount;
  allocation[to] += amount;
};

const normalizeAllocation = (allocation) => {
  for (const bucket of buckets) allocation[bucket] = Math.max(0, Number(allocation[bucket] || 0));
  const total = buckets.reduce((sum, bucket) => sum + allocation[bucket], 0) || 1;
  const normalized = Object.fromEntries(
    buckets.map((bucket) => [bucket, Number(((allocation[bucket] / total) * 100).toFixed(1))])
  );
  const roundedTotal = buckets.reduce((sum, bucket) => sum + normalized[bucket], 0);
  normalized.liquidAssets = Number((normalized.liquidAssets + (100 - roundedTotal)).toFixed(1));
  return normalized;
};

const calculateRiskScore = (input) => {
  const startingScore = { conservative: 30, balanced: 55, growth: 78 }[input.riskTolerance];
  let score = startingScore;
  if (input.investmentHorizonYears >= 10) score += 8;
  else if (input.investmentHorizonYears <= 3) score -= 12;
  if (input.age >= 55) score -= 12;
  else if (input.age >= 45) score -= 6;
  if (input.incomeStability === "unstable") score -= 10;
  else if (input.incomeStability === "stable") score += 4;
  if (input.investmentExperience === "beginner") score -= 5;
  else if (input.investmentExperience === "experienced") score += 4;
  if (input.dependents >= 3) score -= 5;
  return clamp(score, 0, 100);
};

const scoreToBand = (score) => (score < 43 ? "conservative" : score < 68 ? "balanced" : "growth");

export const buildPortfolioRecommendation = (input) => {
  const riskScore = calculateRiskScore(input);
  const riskBand = scoreToBand(riskScore);
  const allocation = { ...baseAllocations[riskBand] };
  const rationale = [`Risk capacity and preferences produced a ${riskBand} profile (${riskScore}/100).`];
  const warnings = [];
  const monthlySurplus = input.monthlyIncome - input.monthlyEssentialExpenses - input.monthlyDebtPayments;
  const targetMonths = clamp(
    6 + (input.incomeStability === "unstable" ? 3 : input.incomeStability === "variable" ? 1 : 0) +
      (input.dependents > 0 ? 2 : 0),
    6,
    12
  );
  const targetAmount = (input.monthlyEssentialExpenses + input.monthlyDebtPayments) * targetMonths;
  const gap = Math.max(targetAmount - input.liquidSavings, 0);
  const fundedPercentage = targetAmount
    ? clamp(Number(((input.liquidSavings / targetAmount) * 100).toFixed(1)), 0, 100)
    : 100;

  if (input.investmentHorizonYears <= 3) {
    shift(allocation, "equityMutualFunds", "liquidAssets", 8);
    shift(allocation, "equityMutualFunds", "debtMutualFunds", 7);
    rationale.push("The short investment horizon shifts weight from equity toward liquid and debt assets.");
  } else if (input.investmentHorizonYears <= 6) {
    shift(allocation, "equityMutualFunds", "debtMutualFunds", 5);
  }

  if (input.age >= 55) {
    shift(allocation, "equityMutualFunds", "debtMutualFunds", 7);
    shift(allocation, "equityMutualFunds", "liquidAssets", 3);
  } else if (input.age >= 45) {
    shift(allocation, "equityMutualFunds", "debtMutualFunds", 5);
  }

  if (fundedPercentage < 100) {
    const emergencyTarget = fundedPercentage < 50 ? 22 : 15;
    const increase = Math.max(emergencyTarget - allocation.emergencyFund, 0);
    shift(allocation, "equityMutualFunds", "emergencyFund", increase * 0.7);
    shift(allocation, "realEstateLand", "emergencyFund", increase * 0.3);
    rationale.push(`Emergency savings are ${fundedPercentage}% funded, so new contributions prioritize liquidity.`);
    warnings.push(`Build an emergency-fund gap of ${gap.toFixed(2)} before making large illiquid commitments.`);
  }

  const realEstateEligible = input.investmentHorizonYears >= 7 && fundedPercentage >= 80 && monthlySurplus > 0;
  if (!realEstateEligible) {
    shift(allocation, "realEstateLand", "liquidAssets", allocation.realEstateLand);
    if (input.preferredRealEstateAllocation > 0) {
      warnings.push("Land or direct real estate is deferred because the liquidity, surplus, or time-horizon test is not met.");
    }
  } else if (input.preferredRealEstateAllocation > allocation.realEstateLand) {
    const desired = Math.min(input.preferredRealEstateAllocation, 20);
    const increase = desired - allocation.realEstateLand;
    shift(allocation, "equityMutualFunds", "realEstateLand", increase * 0.7);
    shift(allocation, "debtMutualFunds", "realEstateLand", increase * 0.3);
    rationale.push("The real-estate allocation reflects the stated preference but is capped to limit illiquidity.");
  }

  if (input.incomeStability === "unstable") {
    shift(allocation, "equityMutualFunds", "liquidAssets", 4);
    rationale.push("Variable income increases the suggested liquid-asset reserve.");
  }
  if (input.investmentExperience === "beginner") {
    shift(allocation, "equityMutualFunds", "debtMutualFunds", 3);
    warnings.push("Use diversified, understandable products and review fees and risk documents before investing.");
  }
  if (monthlySurplus <= 0) {
    warnings.push("Monthly essential expenses and debt payments currently consume all reported income.");
  }
  if (!input.hasHealthInsurance) warnings.push("Review health-insurance adequacy before increasing market risk.");
  if (input.dependents > 0 && !input.hasTermInsurance) warnings.push("With dependents, review whether term-life cover is appropriate.");

  return {
    riskScore,
    riskBand,
    recommendedAllocation: normalizeAllocation(allocation),
    emergencyFund: {
      targetMonths,
      targetAmount: Number(targetAmount.toFixed(2)),
      currentAmount: Number(input.liquidSavings.toFixed(2)),
      gap: Number(gap.toFixed(2)),
      fundedPercentage
    },
    monthlySurplus: Number(monthlySurplus.toFixed(2)),
    rationale,
    warnings,
    engineVersion: "1.0.0",
    disclaimer: ADVISORY_DISCLAIMER
  };
};

const mapAssetType = (assetType) => {
  const value = String(assetType || "").toLowerCase();
  if (/emergency/.test(value)) return "emergencyFund";
  if (/land|real.?estate|property/.test(value)) return "realEstateLand";
  if (/gold|precious/.test(value)) return "gold";
  if (/debt|bond|gilt/.test(value)) return "debtMutualFunds";
  if (/cash|liquid|saving|fixed.?deposit|\bfd\b/.test(value)) return "liquidAssets";
  if (/mutual|equity|stock|share|etf|index/.test(value)) return "equityMutualFunds";
  return null;
};

export const calculateCurrentAllocation = (investments, liquidSavings = 0) => {
  const values = Object.fromEntries(buckets.map((bucket) => [bucket, 0]));
  values.emergencyFund = Number(liquidSavings || 0);
  let unmappedValue = 0;
  for (const investment of investments) {
    const bucket = mapAssetType(investment.assetType);
    if (bucket) values[bucket] += Number(investment.currentValue || 0);
    else unmappedValue += Number(investment.currentValue || 0);
  }
  const total = buckets.reduce((sum, bucket) => sum + values[bucket], 0);
  const percentages = Object.fromEntries(
    buckets.map((bucket) => [bucket, total ? Number(((values[bucket] / total) * 100).toFixed(1)) : 0])
  );
  return { values, percentages, mappedValue: Number(total.toFixed(2)), unmappedValue: Number(unmappedValue.toFixed(2)) };
};

export const buildRebalancingView = (current, target) =>
  buckets.map((bucket) => ({
    bucket,
    currentPercentage: current.percentages[bucket],
    targetPercentage: target[bucket],
    differencePercentage: Number((target[bucket] - current.percentages[bucket]).toFixed(1))
  }));

export const savePortfolioRecommendation = async (userId, questionnaire) => {
  const recommendation = buildPortfolioRecommendation(questionnaire);
  const plan = await PortfolioPlan.findOneAndUpdate(
    { user_id: userId },
    { user_id: userId, questionnaire, ...recommendation },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return plan;
};

export const getPortfolioRecommendation = async (userId) => {
  const [plan, investments] = await Promise.all([
    PortfolioPlan.findOne({ user_id: userId }).lean(),
    Investment.find({ user_id: userId }).lean()
  ]);
  if (!plan) return null;
  const currentAllocation = calculateCurrentAllocation(investments, plan.questionnaire.liquidSavings);
  return {
    ...plan,
    currentAllocation,
    rebalancing: buildRebalancingView(currentAllocation, plan.recommendedAllocation)
  };
};

const createNewsletterFlags = (plan, currentAllocation, headlines) => {
  const flags = [];
  if (!plan) {
    flags.push({ code: "QUESTIONNAIRE_REQUIRED", severity: "important", message: "Complete the portfolio questionnaire to receive allocation flags." });
    return flags;
  }
  if (plan.emergencyFund.gap > 0) {
    flags.push({ code: "EMERGENCY_FUND_GAP", severity: "important", message: `Emergency savings are below target by ${plan.emergencyFund.gap.toFixed(2)}.` });
  }
  if (plan.monthlySurplus <= 0) {
    flags.push({ code: "NO_MONTHLY_SURPLUS", severity: "important", message: "Reported expenses and debt payments leave no monthly investing surplus." });
  }
  for (const item of buildRebalancingView(currentAllocation, plan.recommendedAllocation)) {
    if (item.differencePercentage < -7) {
      flags.push({ code: `OVERWEIGHT_${item.bucket.toUpperCase()}`, severity: "warning", message: `${item.bucket} is ${Math.abs(item.differencePercentage).toFixed(1)} percentage points above the educational target.` });
    }
  }
  if (headlines.some((item) => /bearish/i.test(item.sentiment || ""))) {
    flags.push({ code: "BEARISH_NEWS_CONTEXT", severity: "info", message: "At least one relevant headline has bearish provider sentiment; read the source before drawing conclusions." });
  }
  return flags.slice(0, 8);
};

export const getCurrentNewsletter = async (userId, { refresh = false } = {}) => {
  const newsletterKey = new Date().toISOString().slice(0, 10);
  if (!refresh) {
    const existing = await InvestmentNewsletter.findOne({ user_id: userId, newsletterKey }).lean();
    if (existing) return { ...existing, shouldDisplay: !existing.readAt };
  }

  const [plan, investments] = await Promise.all([
    PortfolioPlan.findOne({ user_id: userId }).lean(),
    Investment.find({ user_id: userId }).lean()
  ]);
  const tickers = investments.map((item) => item.symbol).filter(Boolean);
  const currentAllocation = calculateCurrentAllocation(investments, plan?.questionnaire?.liquidSavings || 0);
  const news = await getPortfolioNews({ tickers });
  const flags = createNewsletterFlags(plan, currentAllocation, news.headlines);
  const now = new Date();
  const newsletter = await InvestmentNewsletter.findOneAndUpdate(
    { user_id: userId, newsletterKey },
    {
      $set: {
        mode: news.mode,
        title: `Portfolio briefing — ${newsletterKey}`,
        summary: flags.length
          ? `${flags.length} portfolio item${flags.length === 1 ? "" : "s"} may need your attention.`
          : "No material allocation flags were generated from the latest saved information.",
        flags,
        headlines: news.headlines,
        generatedAt: now,
        disclaimer: ADVISORY_DISCLAIMER
      },
      $setOnInsert: { user_id: userId, newsletterKey, readAt: null }
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return { ...newsletter, shouldDisplay: !newsletter.readAt };
};

export const markNewsletterRead = async (userId, newsletterId) =>
  InvestmentNewsletter.findOneAndUpdate(
    { _id: newsletterId, user_id: userId },
    { readAt: new Date() },
    { new: true }
  ).lean();
