import { Loan } from "../models/Loan.js";
import { normalizeLoanPayload } from "../middleware/validate.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createLoan = asyncHandler(async (req, res) => {
  const payload = normalizeLoanPayload(req.body);
  const loan = await Loan.create({
    ...payload,
    user_id: req.user.user_id
  });

  res.status(201).json(loan);
});

export const getLoans = asyncHandler(async (req, res) => {
  const query = { user_id: req.user.user_id };

  if (req.query.status) {
    query.status = req.query.status;
  }

  const loans = await Loan.find(query).sort({ nextDueDate: 1 }).lean();
  res.json(loans);
});

export const updateLoan = asyncHandler(async (req, res) => {
  const payload = normalizeLoanPayload(req.body);
  const loan = await Loan.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user.user_id },
    payload,
    { new: true, runValidators: true }
  );

  if (!loan) {
    throw new ApiError(404, "Loan not found");
  }

  res.json(loan);
});

export const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndDelete({
    _id: req.params.id,
    user_id: req.user.user_id
  });

  if (!loan) {
    throw new ApiError(404, "Loan not found");
  }

  res.json({ message: "Loan deleted successfully" });
});
