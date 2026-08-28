import { asyncHandler } from "../utils.js";
import { buildFinanceSummary, getFinancialAssessment } from "../services/financeService.js";
import { generateAdvisorExplanation } from "../services/aiService.js";
import { env } from "../config/env.js";

export const getFinanceSummary = asyncHandler(async (req, res) => {
  const summary = await buildFinanceSummary(req.user.user_id);
  res.json(summary);
});

export const getAdvisorAssessment = asyncHandler(async (req, res) => {
  const assessment = await getFinancialAssessment(req.user.user_id);
  res.json(assessment);
});

export const generateAiAdvisorInsight = asyncHandler(async (req, res) => {
  const assessment = await getFinancialAssessment(req.user.user_id);
  const insight = await generateAdvisorExplanation(req.user.user_id, assessment);
  res.json({ ...insight, provider: "xAI", model: env.xAiModel, generatedAt: new Date() });
});
