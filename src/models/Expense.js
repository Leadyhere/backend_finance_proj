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

export const Expense = mongoose.model("Expense", expenseSchema);
