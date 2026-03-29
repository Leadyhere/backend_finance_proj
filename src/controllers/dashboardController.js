import { asyncHandler } from "../utils/asyncHandler.js";
import { getDashboardSnapshot } from "../services/financeService.js";

export const getDashboard = asyncHandler(async (req, res) => {
  const snapshot = await getDashboardSnapshot(req.user.user_id);
  res.json({
    ...snapshot.overview,
    ...snapshot.charts,
    recentTransactions: snapshot.lists.recentTransactions,
    activeGoals: snapshot.lists.activeGoals,
    topInvestments: snapshot.lists.topInvestments,
    activeLoans: snapshot.lists.activeLoans,
    categoryBudgets: snapshot.categoryBudgets,
    overview: snapshot.overview,
    charts: snapshot.charts,
    lists: snapshot.lists,
    profile: snapshot.profile
  });
});
