import mongoose from "mongoose";

const loanSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true
    },
    lender: {
      type: String,
      required: true,
      trim: true
    },
    loanType: {
      type: String,
      required: true,
      trim: true
    },
    principalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    outstandingAmount: {
      type: Number,
      required: true,
      min: 0
    },
    emi: {
      type: Number,
      required: true,
      min: 0
    },
    interestRate: {
      type: Number,
      required: true,
      min: 0
    },
    tenureMonths: {
      type: Number,
      default: 0,
      min: 0
    },
    nextDueDate: {
      type: Date,
      required: true
    },
    secured: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ["active", "closed", "delayed"],
      default: "active"
    },
    notes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

loanSchema.index({ user_id: 1, status: 1, nextDueDate: 1 });

export const Loan = mongoose.model("Loan", loanSchema);
