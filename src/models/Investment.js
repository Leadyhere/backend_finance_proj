import mongoose from "mongoose";

const investmentSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true
    },
    assetName: {
      type: String,
      required: true,
      trim: true
    },
    assetType: {
      type: String,
      required: true,
      trim: true
    },
    symbol: {
      type: String,
      default: "",
      trim: true
    },
    platform: {
      type: String,
      default: "",
      trim: true
    },
    amountInvested: {
      type: Number,
      required: true,
      min: 0
    },
    currentValue: {
      type: Number,
      required: true,
      min: 0
    },
    units: {
      type: Number,
      default: 0,
      min: 0
    },
    riskLevel: {
      type: String,
      enum: ["low", "moderate", "high"],
      default: "moderate"
    },
    purchaseDate: {
      type: Date,
      required: true
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

export const Investment = mongoose.model("Investment", investmentSchema);
