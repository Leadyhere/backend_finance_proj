import mongoose from "mongoose";

const questionnaireSchema = new mongoose.Schema(
  {
    age: { type: Number, required: true, min: 18, max: 100 },
    dependents: { type: Number, default: 0, min: 0 },
    monthlyIncome: { type: Number, required: true, min: 0 },
    monthlyEssentialExpenses: { type: Number, required: true, min: 0 },
    monthlyDebtPayments: { type: Number, default: 0, min: 0 },
    liquidSavings: { type: Number, default: 0, min: 0 },
    investmentHorizonYears: { type: Number, required: true, min: 1, max: 50 },
    riskTolerance: { type: String, enum: ["conservative", "balanced", "growth"], required: true },
    incomeStability: { type: String, enum: ["unstable", "variable", "stable"], required: true },
    investmentExperience: { type: String, enum: ["beginner", "intermediate", "experienced"], required: true },
    hasHealthInsurance: { type: Boolean, default: false },
    hasTermInsurance: { type: Boolean, default: false },
    goals: { type: [String], default: [] },
    preferredRealEstateAllocation: { type: Number, default: 0, min: 0, max: 30 }
  },
  { _id: false }
);

const allocationSchema = new mongoose.Schema(
  {
    equityMutualFunds: { type: Number, required: true, min: 0, max: 100 },
    debtMutualFunds: { type: Number, required: true, min: 0, max: 100 },
    liquidAssets: { type: Number, required: true, min: 0, max: 100 },
    realEstateLand: { type: Number, required: true, min: 0, max: 100 },
    gold: { type: Number, required: true, min: 0, max: 100 },
    emergencyFund: { type: Number, required: true, min: 0, max: 100 }
  },
  { _id: false }
);

const portfolioPlanSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, unique: true, index: true },
    questionnaire: { type: questionnaireSchema, required: true },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    riskBand: { type: String, enum: ["conservative", "balanced", "growth"], required: true },
    recommendedAllocation: { type: allocationSchema, required: true },
    emergencyFund: {
      targetMonths: { type: Number, required: true },
      targetAmount: { type: Number, required: true },
      currentAmount: { type: Number, required: true },
      gap: { type: Number, required: true },
      fundedPercentage: { type: Number, required: true }
    },
    monthlySurplus: { type: Number, required: true },
    rationale: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    engineVersion: { type: String, default: "1.0.0" },
    disclaimer: { type: String, required: true }
  },
  { timestamps: true, versionKey: false }
);

export const PortfolioPlan = mongoose.model("PortfolioPlan", portfolioPlanSchema);
