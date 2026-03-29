import { User } from "../models/User.js";
import { normalizeProfilePayload } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findOneAndUpdate(
    { user_id: req.user.user_id },
    {
      $setOnInsert: {
        user_id: req.user.user_id,
        email: req.user.email || `user-${req.user.user_id}@finance.local`
      }
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );

  res.json(user);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const payload = normalizeProfilePayload(req.body);
  const user = await User.findOneAndUpdate(
    { user_id: req.user.user_id },
    {
      ...payload,
      email: req.user.email || `user-${req.user.user_id}@finance.local`
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );

  res.json(user);
});
