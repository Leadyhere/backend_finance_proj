import mongoose from "mongoose";

const investmentNewsletterSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    newsletterKey: { type: String, required: true },
    mode: { type: String, enum: ["demo", "live"], required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    flags: {
      type: [
        {
          code: String,
          severity: { type: String, enum: ["info", "warning", "important"] },
          message: String
        }
      ],
      default: []
    },
    headlines: {
      type: [
        {
          title: String,
          source: String,
          url: String,
          summary: String,
          publishedAt: mongoose.Schema.Types.Mixed,
          sentiment: String,
          simulated: Boolean
        }
      ],
      default: []
    },
    generatedAt: { type: Date, required: true },
    readAt: { type: Date, default: null },
    disclaimer: { type: String, required: true }
  },
  { timestamps: true, versionKey: false }
);

investmentNewsletterSchema.index({ user_id: 1, newsletterKey: 1 }, { unique: true });

export const InvestmentNewsletter = mongoose.model(
  "InvestmentNewsletter",
  investmentNewsletterSchema
);
