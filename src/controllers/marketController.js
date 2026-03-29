import { getMarketOverviewSnapshot } from "../services/marketService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getMarketOverview = asyncHandler(async (_req, res) => {
  const overview = await getMarketOverviewSnapshot();
  res.json(overview);
});
