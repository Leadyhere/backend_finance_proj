import { Expense } from "../models/Expense.js";
import { ApiError, asyncHandler } from "../utils.js";
import { escapeRegExp, normalizeExpensePayload, parseQueryDate } from "../middleware/validate.js";

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
    const safeSearch = escapeRegExp(search).slice(0, 100);
    query.$or = [
      { description: { $regex: safeSearch, $options: "i" } },
      { notes: { $regex: safeSearch, $options: "i" } }
    ];
  }
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      const parsedStartDate = parseQueryDate(startDate, "Start date");
      query.date.$gte = parsedStartDate;
    }
    if (endDate) {
      const parsedEndDate = parseQueryDate(endDate, "End date", { endOfDay: true });
      query.date.$lte = parsedEndDate;
    }
    if (query.date.$gte && query.date.$lte && query.date.$gte > query.date.$lte) {
      throw new ApiError(400, "Start date cannot be after end date");
    }
  }

  const pageNumber = Number(page);
  const requestedPageSize = Number(limit);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new ApiError(400, "Page must be a positive integer");
  if (!Number.isInteger(requestedPageSize) || requestedPageSize < 1) throw new ApiError(400, "Limit must be a positive integer");
  const pageSize = Math.min(requestedPageSize, 50);
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
  const payload = normalizeExpensePayload(req.body, { partial: req.method === "PATCH" });
  const currentExpense = await Expense.findOne({
    _id: req.params.id,
    user_id: req.user.user_id
  }).lean();
  if (!currentExpense) throw new ApiError(404, "Expense not found");

  if (Object.hasOwn(req.body, "necessityType") || Object.hasOwn(req.body, "amount")) {
    const necessityType = payload.necessityType || currentExpense.necessityType || "uncategorized";
    const amount = payload.amount ?? currentExpense.amount;
    const savingsRate = { needs: 0, wants: 0.5, luxury: 0.8, uncategorized: 0 }[necessityType];
    payload.potentialSavings = Number((amount * savingsRate).toFixed(2));
  }
  if (Object.hasOwn(req.body, "category") || Object.hasOwn(req.body, "necessityType")) {
    payload.classificationSource = "user_review";
  }

  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user.user_id },
    payload,
    { new: true, runValidators: true }
  );

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
