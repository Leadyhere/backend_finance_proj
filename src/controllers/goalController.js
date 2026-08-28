import { InvestmentGoal } from "../models/InvestmentGoal.js";
import { normalizeGoalPayload } from "../middleware/validate.js";
import { ApiError, asyncHandler } from "../utils.js";

export const createGoal = asyncHandler(async (req, res) => {
  const payload = normalizeGoalPayload(req.body);
  const goal = await InvestmentGoal.create({
    ...payload,
    user_id: req.user.user_id
  });

  res.status(201).json(goal);
});

export const getGoals = asyncHandler(async (req, res) => {
  const query = { user_id: req.user.user_id };

  if (req.query.status) {
    query.status = req.query.status;
  }

  const goals = await InvestmentGoal.find(query).sort({ targetDate: 1 }).lean();
  res.json(goals);
});

export const updateGoal = asyncHandler(async (req, res) => {
  const payload = normalizeGoalPayload(req.body, { partial: req.method === "PATCH" });
  const goal = await InvestmentGoal.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user.user_id },
    payload,
    { new: true, runValidators: true }
  );

  if (!goal) {
    throw new ApiError(404, "Goal not found");
  }

  res.json(goal);
});

export const deleteGoal = asyncHandler(async (req, res) => {
  const goal = await InvestmentGoal.findOneAndDelete({
    _id: req.params.id,
    user_id: req.user.user_id
  });

  if (!goal) {
    throw new ApiError(404, "Goal not found");
  }

  res.json({ message: "Goal deleted successfully" });
});
