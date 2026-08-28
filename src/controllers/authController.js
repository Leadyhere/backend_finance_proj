import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { ensureDemoWorkspace } from "../services/financeService.js";
import { ApiError, asyncHandler } from "../utils.js";

export const createDemoSession = asyncHandler(async (_req, res) => {
  if (!env.demoMode) throw new ApiError(404, "Demo access is not enabled");
  const userId = "resume-demo-user";
  await ensureDemoWorkspace(userId);
  const token = jwt.sign(
    { user_id: userId, email: "demo@finance.local", scope: "demo" },
    env.jwtSecret,
    { algorithm: "HS256", expiresIn: "8h" }
  );
  res.json({
    token,
    expiresIn: 28800,
    user: { user_id: userId, email: "demo@finance.local", full_name: "Aarav Mehta" }
  });
});

export const getSession = asyncHandler(async (req, res) => {
  const user = await User.findOneAndUpdate(
    { user_id: req.user.user_id },
    {
      $setOnInsert: {
        user_id: req.user.user_id
      },
      $set: {
        email: req.user.email || `user-${req.user.user_id}@finance.local`
      }
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );

  res.json({
    authenticated: true,
    user
  });
});
