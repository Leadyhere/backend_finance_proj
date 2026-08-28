import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;
let app;
let disconnectDatabase;
let token;
let ExpenseImport;
let confirmExpenseImport;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.JWT_SECRET = "integration-test-secret";
  process.env.DB_URI = mongo.getUri("finance_api_test");
  process.env.PORT = "5001";
  process.env.MARKET_FEED_MODE = "demo";
  process.env.LOG_LEVEL = "silent";
  process.env.DEMO_MODE = "true";

  const appModule = await import("../src/app.js");
  const dbModule = await import("../src/config/db.js");
  ({ ExpenseImport } = await import("../src/models/ExpenseImport.js"));
  ({ confirmExpenseImport } = await import("../src/services/expenseIntelligenceService.js"));
  disconnectDatabase = dbModule.disconnectDatabase;
  await dbModule.connectDatabase();
  app = appModule.createApp();
  token = jwt.sign({ user_id: "integration-user", email: "integration@example.com" }, process.env.JWT_SECRET, { algorithm: "HS256" });
});

after(async () => {
  if (disconnectDatabase) await disconnectDatabase();
  if (mongo) await mongo.stop();
});

test("public documentation and authentication boundary work", async () => {
  await request(app).get("/").expect(200).expect("Content-Type", /html/);
  const apiOverview = await request(app).get("/api").expect(200).expect("Content-Type", /json/);
  assert.equal(apiOverview.body.version, "3.0.0");
  await request(app).get("/openapi.json").expect(200);
  const unauthorized = await request(app).get("/dashboard").expect(401);
  assert.equal(unauthorized.body.message, "Authentication token is required");
  assert.ok(unauthorized.body.requestId);
});

test("resume demo session bootstraps a complete interactive workspace", async () => {
  const demo = await request(app).post("/auth/demo").expect(200);
  assert.ok(demo.body.token);
  assert.equal(demo.body.user.user_id, "resume-demo-user");
  const assessment = await request(app)
    .get("/advisor/assessment")
    .set("Authorization", `Bearer ${demo.body.token}`)
    .expect(200);
  assert.ok(assessment.body.health.score > 0);
  assert.equal(assessment.body.dataCompleteness.percentage, 100);
  assert.ok(assessment.body.actions.some((action) => action.category === "safety"));
  const dashboard = await request(app)
    .get("/dashboard")
    .set("Authorization", `Bearer ${demo.body.token}`)
    .expect(200);
  assert.equal(dashboard.body.overview.monthlyBudget, 65000);
  assert.equal(dashboard.body.overview.budgetAlertThreshold, 80);
  assert.match(dashboard.body.overview.budgetMonth, /^\d{4}-\d{2}$/);
});

test("inflation calculator validates, calculates, and saves per-user assumptions", async () => {
  const calculated = await request(app)
    .post("/inflation/calculate")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentAmount: 100000, years: 10, inflationRate: 6, expectedReturn: 10, saveAssumptions: true })
    .expect(200);
  assert.equal(calculated.body.projection.futureCost, 179084.77);
  assert.equal(calculated.body.projection.purchasingPower, 55839.48);
  assert.equal(calculated.body.assumptions.savedForUser, true);

  const session = await request(app).get("/auth/session").set("Authorization", `Bearer ${token}`).expect(200);
  assert.equal(session.body.user.inflation_profile.inflationRate, 6);
  assert.equal(session.body.user.inflation_profile.expectedReturn, 10);

  await request(app)
    .post("/inflation/calculate")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentAmount: 100000, years: 0, inflationRate: 6, expectedReturn: 10 })
    .expect(400);
});

test("Grok advisor endpoint fails safely when no xAI API key is configured", async () => {
  const response = await request(app)
    .post("/advisor/ai-insight")
    .set("Authorization", `Bearer ${token}`)
    .expect(503);
  assert.match(response.body.message, /XAI_API_KEY/);
});

test("expense CRUD supports strict booleans and partial updates", async () => {
  const created = await request(app)
    .post("/expenses")
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 1250, category: "Food", description: "Groceries", date: "2026-08-10", recurring: "false" })
    .expect(201);
  assert.equal(created.body.recurring, false);

  const updated = await request(app)
    .patch(`/expenses/${created.body._id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 1400 })
    .expect(200);
  assert.equal(updated.body.amount, 1400);

  await request(app)
    .patch("/expenses/not-an-object-id")
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 1 })
    .expect(400);
});

test("expense input preserves text and validates pagination, dates, and inclusive end days", async () => {
  const created = await request(app)
    .post("/expenses")
    .set("Authorization", `Bearer ${token}`)
    .send({
      amount: 499,
      category: "Food & dining",
      description: "R&D's team dinner",
      date: "2026-08-10T18:30:00.000Z"
    })
    .expect(201);
  assert.equal(created.body.category, "Food & dining");
  assert.equal(created.body.description, "R&D's team dinner");

  const sameDay = await request(app)
    .get("/expenses?startDate=2026-08-10&endDate=2026-08-10&limit=50")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.ok(sameDay.body.items.some((item) => item._id === created.body._id));

  const sameDayAnalytics = await request(app)
    .get("/expense-analytics/classification?startDate=2026-08-10&endDate=2026-08-10")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.ok(sameDayAnalytics.body.selected.totalSpent >= 499);

  await request(app)
    .get("/expenses?page=2abc")
    .set("Authorization", `Bearer ${token}`)
    .expect(400);
  await request(app)
    .get("/expenses?startDate=2026-08-11&endDate=2026-08-10")
    .set("Authorization", `Bearer ${token}`)
    .expect(400);
  await request(app)
    .post("/expenses")
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 100, category: "Test", description: "Impossible date", date: "2026-02-31" })
    .expect(400);
  await request(app)
    .post("/expenses")
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: null, category: "Test", description: "Missing amount", date: "2026-08-10" })
    .expect(400);
  await request(app)
    .post("/goals")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Zero target", targetAmount: 0, targetDate: "2027-01-01" })
    .expect(400);
});

test("dashboard totals include investments beyond the display-list limit", async () => {
  for (let index = 1; index <= 7; index += 1) {
    await request(app)
      .post("/investments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetName: `Fund ${index}`,
        assetType: "Equity Mutual Fund",
        amountInvested: 1000,
        currentValue: 1100,
        purchaseDate: "2025-01-01"
      })
      .expect(201);
  }
  const dashboard = await request(app)
    .get("/dashboard")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(dashboard.body.portfolioValue, 7700);
  assert.equal(dashboard.body.investmentCount, 7);
  assert.equal(dashboard.body.topInvestments.length, 6);
});

test("portfolio recommendation and unread newsletter lifecycle work", async () => {
  const recommendation = await request(app)
    .post("/portfolio/recommendation")
    .set("Authorization", `Bearer ${token}`)
    .send({
      age: 31,
      dependents: 1,
      monthlyIncome: 120000,
      monthlyEssentialExpenses: 50000,
      monthlyDebtPayments: 10000,
      liquidSavings: 150000,
      investmentHorizonYears: 10,
      riskTolerance: "balanced",
      incomeStability: "stable",
      investmentExperience: "intermediate",
      hasHealthInsurance: true,
      hasTermInsurance: true,
      goals: ["Retirement", "Home"],
      preferredRealEstateAllocation: 10
    })
    .expect(201);
  const total = Object.values(recommendation.body.recommendedAllocation).reduce((sum, value) => sum + value, 0);
  assert.equal(total, 100);
  assert.equal(recommendation.body.currentAllocation.mappedValue, 157700);

  const dashboard = await request(app)
    .get("/dashboard")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(dashboard.body.overview.portfolioValue, 7700);
  assert.equal(dashboard.body.overview.liquidSavings, 150000);
  assert.equal(dashboard.body.overview.netWorth, 157700);

  const newsletter = await request(app)
    .get("/portfolio/newsletter/current")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(newsletter.body.shouldDisplay, true);
  assert.equal(newsletter.body.mode, "demo");

  const acknowledged = await request(app)
    .post(`/portfolio/newsletter/${newsletter.body._id}/read`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(acknowledged.body.shouldDisplay, false);

  const secondRead = await request(app)
    .get("/portfolio/newsletter/current")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(secondRead.body.shouldDisplay, false);
});

test("automatic screenshot import logging powers analytics and supports corrections", async () => {
  const draft = await ExpenseImport.create({
    user_id: "integration-user",
    source: {
      fileName: "spending.png",
      mimeType: "image/png",
      size: 2048,
      sha256: "a".repeat(64)
    },
    ocrConfidence: 91,
    ocrPreview: "Swiggy ₹800 Pharmacy ₹400",
    items: [
      {
        date: new Date(),
        description: "Swiggy order",
        merchant: "Swiggy",
        amount: 800,
        category: "Dining",
        necessityType: "wants",
        potentialSavings: 400,
        classificationConfidence: 82
      },
      {
        date: new Date(),
        description: "Pharmacy",
        merchant: "Local Pharmacy",
        amount: 400,
        category: "Healthcare",
        necessityType: "needs",
        potentialSavings: 0,
        classificationConfidence: 82
      }
    ]
  });

  const confirmed = await confirmExpenseImport("integration-user", draft._id);
  assert.equal(confirmed.confirmedExpenseIds.length, 2);

  const corrected = await request(app)
    .patch(`/expenses/${confirmed.confirmedExpenseIds[0]}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ category: "Luxury dining", necessityType: "luxury" })
    .expect(200);
  assert.equal(corrected.body.classificationSource, "user_review");
  assert.equal(corrected.body.potentialSavings, 640);

  const analytics = await request(app)
    .get("/expense-analytics/classification")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.ok(analytics.body.selected.totalSpent >= 1200);
  assert.ok(analytics.body.savingsEstimates.currentMonthPotential >= 640);
  assert.equal(analytics.body.chart.type, "pie");

  const assessment = await request(app)
    .get("/advisor/assessment")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.ok(Number.isInteger(assessment.body.health.score));
  assert.ok(assessment.body.health.dimensions.length === 6);
  assert.ok(Array.isArray(assessment.body.actions));

  const chart = await request(app)
    .get("/expense-analytics/classification/chart.svg")
    .set("Authorization", `Bearer ${token}`)
    .expect(200)
    .expect("Content-Type", /svg/);
  assert.match(chart.body.toString("utf8"), /Expense classification/);
});

test("screenshot upload rejects non-image files before an AI call", async () => {
  await request(app)
    .post("/expense-imports/screenshot")
    .set("Authorization", `Bearer ${token}`)
    .attach("screenshot", Buffer.from("not-an-image"), {
      filename: "spending.txt",
      contentType: "text/plain"
    })
    .expect(400);

  await request(app)
    .post("/expense-imports/screenshot")
    .set("Authorization", `Bearer ${token}`)
    .attach("screenshot", Buffer.from("not-really-a-png"), {
      filename: "spending.png",
      contentType: "image/png"
    })
    .expect(400);
});
