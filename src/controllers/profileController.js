import { User } from "../models/User.js";
import { normalizeInflationPayload, normalizeProfilePayload } from "../middleware/validate.js";
import { asyncHandler } from "../utils.js";

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

const money = (value) => Number(value.toFixed(2));

export const calculateInflation = asyncHandler(async (req, res) => {
  const input = normalizeInflationPayload(req.body);
  if (input.saveAssumptions) {
    await User.findOneAndUpdate(
      { user_id: req.user.user_id },
      {
        $set: {
          "inflation_profile.inflationRate": input.inflationRate,
          "inflation_profile.expectedReturn": input.expectedReturn,
          email: req.user.email || `user-${req.user.user_id}@finance.local`
        },
        $setOnInsert: { user_id: req.user.user_id }
      },
      { upsert: true, runValidators: true }
    );
  }

  const inflationFactor = (1 + input.inflationRate / 100) ** input.years;
  const futureCost = input.currentAmount * inflationFactor;
  const purchasingPower = input.currentAmount / inflationFactor;
  const periods = input.years * 12;
  const monthlyReturn = input.expectedReturn / 100 / 12;
  const monthlyInvestment = monthlyReturn === 0
    ? futureCost / periods
    : futureCost * monthlyReturn / ((1 + monthlyReturn) ** periods - 1);
  const realExpectedReturn = ((1 + input.expectedReturn / 100) / (1 + input.inflationRate / 100) - 1) * 100;

  res.json({
    assumptions: {
      inflationRate: input.inflationRate,
      expectedReturn: input.expectedReturn,
      savedForUser: input.saveAssumptions
    },
    projection: {
      currentAmount: money(input.currentAmount),
      years: input.years,
      futureCost: money(futureCost),
      purchasingPower: money(purchasingPower),
      lossOfPurchasingPower: money(input.currentAmount - purchasingPower),
      monthlyInvestment: money(monthlyInvestment),
      realExpectedReturn: money(realExpectedReturn)
    },
    disclaimer: "This projection uses fixed rates and is educational, not a guarantee of inflation or investment returns."
  });
});
