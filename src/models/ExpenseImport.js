import mongoose from "mongoose";

const importItemSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String, required: true, trim: true },
  merchant: { type: String, default: "", trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  category: { type: String, required: true, trim: true },
  necessityType: {
    type: String,
    enum: ["needs", "wants", "luxury", "uncategorized"],
    required: true
  },
  potentialSavings: { type: Number, required: true, min: 0 },
  classificationConfidence: { type: Number, required: true, min: 0, max: 100 }
});

const expenseImportSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    source: {
      fileName: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
      sha256: { type: String, required: true }
    },
    ocrConfidence: { type: Number, required: true, min: 0, max: 100 },
    ocrPreview: { type: String, default: "" },
    items: { type: [importItemSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "processing", "confirmed", "rejected"],
      default: "draft",
      index: true
    },
    confirmedExpenseIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Expense" }],
      default: []
    },
    confirmedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

expenseImportSchema.index({ user_id: 1, "source.sha256": 1 }, { unique: true });

export const ExpenseImport = mongoose.model("ExpenseImport", expenseImportSchema);
