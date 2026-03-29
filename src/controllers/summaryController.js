import { asyncHandler } from "../utils/asyncHandler.js";
import { buildFinanceSummary } from "../services/financeService.js";

export const getFinanceSummary = asyncHandler(async (req, res) => {
  const summary = await buildFinanceSummary(req.user.user_id);
  res.json(summary);
});
