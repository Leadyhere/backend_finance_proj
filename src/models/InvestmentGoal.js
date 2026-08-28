import mongoose from "mongoose";

const investmentGoalSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    goalType: {
      type: String,
      default: "wealth",
      trim: true
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    monthlyContribution: {
      type: Number,
      default: 0,
      min: 0
    },
    expectedReturn: {
      type: Number,
      default: 0,
      min: 0
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    },
    targetDate: {
      type: Date,
      required: true
    },
    notes: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["planned", "active", "completed", "paused"],
      default: "active"
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

investmentGoalSchema.index({ user_id: 1, status: 1, targetDate: 1 });

export const InvestmentGoal = mongoose.model("InvestmentGoal", investmentGoalSchema);
