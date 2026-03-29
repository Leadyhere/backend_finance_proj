import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    full_name: {
      type: String,
      default: ""
    },
    phone: {
      type: String,
      default: ""
    },
    preferred_currency: {
      type: String,
      default: "INR"
    },
    locale: {
      type: String,
      default: "en-IN"
    },
    monthly_income: {
      type: Number,
      default: 0
    },
    target_savings: {
      type: Number,
      default: 0
    },
    risk_profile: {
      type: String,
      enum: ["conservative", "moderate", "aggressive"],
      default: "moderate"
    },
    occupation: {
      type: String,
      default: ""
    },
    city: {
      type: String,
      default: ""
    },
    avatar_url: {
      type: String,
      default: ""
    },
    notification_preferences: {
      budgetAlerts: {
        type: Boolean,
        default: true
      },
      marketDigest: {
        type: Boolean,
        default: true
      },
      billReminders: {
        type: Boolean,
        default: true
      }
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: false
    },
    versionKey: false
  }
);

export const User = mongoose.model("User", userSchema);
