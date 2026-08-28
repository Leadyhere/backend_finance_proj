import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.JWT_SECRET = "test-secret";
process.env.DB_URI = "mongodb://127.0.0.1:27017/unit-test-placeholder";
process.env.MARKET_FEED_MODE = "demo";

const { buildPortfolioRecommendation } = await import("../src/services/portfolioAdvisorService.js");
const { extractExpensesFromScreenshot, requestGrokJson } = await import("../src/services/aiService.js");
const { buildFinancialAssessment } = await import("../src/services/financeService.js");

const questionnaire = {
  age: 32,
  dependents: 1,
  monthlyIncome: 120000,
  monthlyEssentialExpenses: 50000,
  monthlyDebtPayments: 10000,
  liquidSavings: 50000,
  investmentHorizonYears: 10,
  riskTolerance: "balanced",
  incomeStability: "stable",
  investmentExperience: "intermediate",
  hasHealthInsurance: true,
  hasTermInsurance: true,
  goals: ["retirement"],
  preferredRealEstateAllocation: 15
};

test("allocation always totals 100 percent", () => {
  const result = buildPortfolioRecommendation(questionnaire);
  assert.equal(Object.values(result.recommendedAllocation).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(result.monthlySurplus, 60000);
  assert.ok(result.emergencyFund.gap > 0);
});

test("land is deferred when emergency liquidity is insufficient", () => {
  const result = buildPortfolioRecommendation({
    ...questionnaire,
    investmentHorizonYears: 12,
    liquidSavings: 0,
    preferredRealEstateAllocation: 20
  });
  assert.equal(result.recommendedAllocation.realEstateLand, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("Land")));
});

test("real-estate preference is capped when eligibility tests pass", () => {
  const result = buildPortfolioRecommendation({
    ...questionnaire,
    liquidSavings: 1000000,
    preferredRealEstateAllocation: 30
  });
  assert.equal(result.recommendedAllocation.realEstateLand, 20);
});

test("Grok vision uses xAI Responses structured output and deterministic savings math", async () => {
  let requestBody;
  let requestUrl;
  const result = await extractExpensesFromScreenshot("test-user", {
    mimetype: "image/png",
    buffer: Buffer.from("fake-image")
  }, {
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ output_text: JSON.stringify({
          confidence: 92,
          items: [{
            date: "2026-08-14",
            description: "Dinner",
            merchant: "Restaurant",
            amount: 800,
            category: "Dining",
            necessityType: "wants",
            classificationConfidence: 88
          }]
        }) })
      };
    }
  });
  assert.equal(requestUrl, "https://api.x.ai/v1/responses");
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.model, "grok-4.6");
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.match(requestBody.input[0].content[1].image_url, /^data:image\/png;base64,/);
  assert.equal(result.items[0].potentialSavings, 400);
});

test("AI features fail clearly when the server key is absent", async () => {
  await assert.rejects(
    requestGrokJson({
      userId: "test-user",
      instructions: "test",
      content: [],
      schema: {},
      schemaName: "test",
      apiKey: ""
    }),
    (error) => error.statusCode === 503 && /XAI_API_KEY/.test(error.message)
  );
});

test("modal dismiss controls cannot submit required financial forms", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(html, /id="formCloseButton" type="button"/);
  assert.match(html, /id="formCancelButton" type="button"/);
  assert.doesNotMatch(html, /id="recordForm"[^>]*method="dialog"/);
  assert.match(script, /formCloseButton"\)\.addEventListener\("click"/);
  assert.match(script, /formCancelButton"\)\.addEventListener\("click"/);
});

test("frontend restores valid hash routes and uses local calendar date values", () => {
  const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(script, /window\.location\.hash/);
  assert.match(script, /window\.addEventListener\("hashchange"/);
  assert.match(script, /date\.getFullYear\(\)/);
  assert.doesNotMatch(script, /const dateValue[^\n]*toISOString/);
});

test("whole-picture assessment prioritizes liquidity and expensive debt", () => {
  const plan = { ...buildPortfolioRecommendation(questionnaire), questionnaire };
  const assessment = buildFinancialAssessment({
    profile: { monthly_income: 120000 },
    plan,
    budgetSnapshot: { monthlyBudget: 65000 },
    currentMonthExpenses: 55000,
    monthlyExpenseTotals: [{ total: 55000 }, { total: 52000 }, { total: 50000 }],
    classification: [
      { type: "needs", total: 35000, potentialSavings: 0 },
      { type: "wants", total: 12000, potentialSavings: 6000 },
      { type: "luxury", total: 8000, potentialSavings: 6400 }
    ],
    investments: [{ assetType: "Equity Mutual Fund", amountInvested: 100000, currentValue: 110000 }],
    loans: [{ status: "active", loanType: "Personal", lender: "Bank", emi: 18000, outstandingAmount: 300000, interestRate: 14 }],
    goals: [{ _id: "goal-1", title: "Home", status: "active", priority: "high", targetAmount: 1000000, currentAmount: 100000, monthlyContribution: 10000, targetDate: new Date(Date.now() + 730 * 86400000) }]
  });
  assert.equal(assessment.health.dimensions.length, 6);
  assert.ok(assessment.actions.some((action) => action.id === "emergency-fund"));
  assert.ok(assessment.actions.some((action) => action.id === "high-cost-debt"));
  assert.equal(assessment.dataCompleteness.percentage, 100);
});
