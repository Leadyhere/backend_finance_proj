import { normalizePortfolioQuestionnaire } from "../middleware/validate.js";
import { ApiError, asyncHandler } from "../utils.js";
import {
  getCurrentNewsletter,
  getPortfolioRecommendation,
  markNewsletterRead,
  savePortfolioRecommendation
} from "../services/portfolioAdvisorService.js";

export const createPortfolioRecommendation = asyncHandler(async (req, res) => {
  const questionnaire = normalizePortfolioQuestionnaire(req.body);
  await savePortfolioRecommendation(req.user.user_id, questionnaire);
  const recommendation = await getPortfolioRecommendation(req.user.user_id);
  res.status(201).json(recommendation);
});

export const readPortfolioRecommendation = asyncHandler(async (req, res) => {
  const recommendation = await getPortfolioRecommendation(req.user.user_id);
  if (!recommendation) throw new ApiError(404, "Complete the portfolio questionnaire first");
  res.json(recommendation);
});

export const readCurrentNewsletter = asyncHandler(async (req, res) => {
  const newsletter = await getCurrentNewsletter(req.user.user_id, {
    refresh: req.query.refresh === "true"
  });
  res.json(newsletter);
});

export const acknowledgeNewsletter = asyncHandler(async (req, res) => {
  const newsletter = await markNewsletterRead(req.user.user_id, req.params.id);
  if (!newsletter) throw new ApiError(404, "Newsletter not found");
  res.json({ ...newsletter, shouldDisplay: false });
});
