import { Budget } from "../models/Budget.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeBudgetPayload } from "../middleware/validate.js";

export const createBudget = asyncHandler(async (req, res) => {
  const payload = normalizeBudgetPayload(req.body);
  const budget = await Budget.findOneAndUpdate(
    {
      user_id: req.user.user_id,
      category: payload.category,
      month: payload.month
    },
    {
      ...payload,
      user_id: req.user.user_id
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );

  res.status(201).json(budget);
});

export const getBudgets = asyncHandler(async (req, res) => {
  const query = { user_id: req.user.user_id };

  if (req.query.month) {
    query.month = req.query.month;
  }

  const budgets = await Budget.find(query).sort({ month: -1, category: 1 }).lean();
  res.json(budgets);
});

export const updateBudget = asyncHandler(async (req, res) => {
  const payload = normalizeBudgetPayload(req.body);
  const budget = await Budget.findOneAndUpdate(
    {
      user_id: req.user.user_id,
      category: payload.category,
      month: payload.month
    },
    payload,
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );

  res.json(budget);
});
