import mongoose from "mongoose";

const migrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    appliedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export const Migration = mongoose.model("Migration", migrationSchema);
