import { Investment } from "../models/Investment.js";
import { normalizeInvestmentPayload } from "../middleware/validate.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createInvestment = asyncHandler(async (req, res) => {
  const payload = normalizeInvestmentPayload(req.body);
  const investment = await Investment.create({
    ...payload,
    user_id: req.user.user_id
  });

  res.status(201).json(investment);
});

export const getInvestments = asyncHandler(async (req, res) => {
  const query = { user_id: req.user.user_id };

  if (req.query.assetType) {
    query.assetType = req.query.assetType;
  }

  const investments = await Investment.find(query).sort({ currentValue: -1 }).lean();
  res.json(investments);
});

export const updateInvestment = asyncHandler(async (req, res) => {
  const payload = normalizeInvestmentPayload(req.body);
  const investment = await Investment.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user.user_id },
    payload,
    { new: true, runValidators: true }
  );

  if (!investment) {
    throw new ApiError(404, "Investment not found");
  }

  res.json(investment);
});

export const deleteInvestment = asyncHandler(async (req, res) => {
  const investment = await Investment.findOneAndDelete({
    _id: req.params.id,
    user_id: req.user.user_id
  });

  if (!investment) {
    throw new ApiError(404, "Investment not found");
  }

  res.json({ message: "Investment deleted successfully" });
});
