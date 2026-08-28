import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    tags: {
      type: [String],
      default: []
    },
    notes: {
      type: String,
      default: ""
    },
    date: {
      type: Date,
      required: true
    },
    recurring: {
      type: Boolean,
      default: false
    },
    merchant: {
      type: String,
      default: ""
    },
    necessityType: {
      type: String,
      enum: ["needs", "wants", "luxury", "uncategorized"],
      default: "uncategorized",
      index: true
    },
    classificationSource: {
      type: String,
      enum: ["manual", "screenshot_rule", "screenshot_ai", "user_review"],
      default: "manual"
    },
    potentialSavings: {
      type: Number,
      default: 0,
      min: 0
    },
    import_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseImport",
      default: null
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    versionKey: false
  }
);

expenseSchema.index({ user_id: 1, date: -1 });
expenseSchema.index({ user_id: 1, category: 1, date: -1 });
expenseSchema.index({ user_id: 1, necessityType: 1, date: -1 });

export const Expense = mongoose.model("Expense", expenseSchema);
