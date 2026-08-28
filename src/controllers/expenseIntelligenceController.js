import { Expense } from "../models/Expense.js";
import {
  confirmExpenseImport,
  createExpenseImport,
  getExpenseClassificationAnalytics,
  renderExpensePieChart
} from "../services/expenseIntelligenceService.js";
import { ApiError, asyncHandler } from "../utils.js";

const hasValidImageSignature = (file) => {
  const bytes = file.buffer;
  if (file.mimetype === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (file.mimetype === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return false;
};

export const analyzeExpenseScreenshot = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Attach an image using the screenshot field");
  if (!hasValidImageSignature(req.file)) throw new ApiError(400, "Screenshot content is not a valid PNG or JPEG image");
  const expenseImport = await createExpenseImport(req.user.user_id, req.file);
  const confirmedImport = await confirmExpenseImport(req.user.user_id, expenseImport._id);
  const loggedExpenses = await Expense.find({
    _id: { $in: confirmedImport.confirmedExpenseIds },
    user_id: req.user.user_id
  }).sort({ date: -1 }).lean();
  res.status(expenseImport.duplicate ? 200 : 201).json({
    import: confirmedImport,
    loggedExpenses,
    loggedExpenseCount: loggedExpenses.length,
    automaticallyLogged: true,
    message: expenseImport.duplicate
      ? "This screenshot was already processed; existing logged expenses were returned."
      : "Screenshot expenses were classified and added to the expense history automatically.",
    correction: {
      endpoint: "/expenses/:id",
      method: "PATCH",
      editableFields: ["category", "necessityType", "description", "merchant", "amount", "date"]
    }
  });
});

export const readExpenseClassificationAnalytics = asyncHandler(async (req, res) => {
  const analytics = await getExpenseClassificationAnalytics(req.user.user_id, req.query);
  res.json(analytics);
});

export const readExpenseClassificationChart = asyncHandler(async (req, res) => {
  const analytics = await getExpenseClassificationAnalytics(req.user.user_id, req.query);
  res.type("image/svg+xml").send(renderExpensePieChart(analytics));
});
