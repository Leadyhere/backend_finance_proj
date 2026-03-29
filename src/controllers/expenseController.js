import { Expense } from "../models/Expense.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeExpensePayload } from "../middleware/validate.js";

export const createExpense = asyncHandler(async (req, res) => {
  const payload = normalizeExpensePayload(req.body);
  const expense = await Expense.create({
    ...payload,
    user_id: req.user.user_id
  });

  res.status(201).json(expense);
});

export const getExpenses = asyncHandler(async (req, res) => {
  const {
    search = "",
    category,
    tag,
    startDate,
    endDate,
    sortBy = "date",
    order = "desc",
    page = 1,
    limit = 10
  } = req.query;

  const query = { user_id: req.user.user_id };

  if (category) {
    query.category = category;
  }
  if (tag) {
    query.tags = tag;
  }
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: "i" } },
      { notes: { $regex: search, $options: "i" } }
    ];
  }
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate);
    }
  }

  const pageNumber = Number(page) || 1;
  const pageSize = Math.min(Number(limit) || 10, 50);
  const allowedSortFields = ["date", "amount", "category", "created_at"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "date";
  const sortDirection = order === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    Expense.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Expense.countDocuments(query)
  ]);

  res.json({
    items,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.ceil(total / pageSize)
    }
  });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const payload = normalizeExpensePayload(req.body);
  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user.user_id },
    payload,
    { new: true, runValidators: true }
  );

  if (!expense) {
    throw new ApiError(404, "Expense not found");
  }

  res.json(expense);
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({
    _id: req.params.id,
    user_id: req.user.user_id
  });

  if (!expense) {
    throw new ApiError(404, "Expense not found");
  }

  res.json({ message: "Expense deleted successfully" });
});
