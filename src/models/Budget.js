import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
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
      default: "overall",
      trim: true
    },
    month: {
      type: String,
      required: true
    },
    alertThreshold: {
      type: Number,
      default: 80
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

budgetSchema.index({ user_id: 1, category: 1, month: 1 }, { unique: true });

export const Budget = mongoose.model("Budget", budgetSchema);
