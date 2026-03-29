import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
