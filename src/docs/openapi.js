const bearerSecurity = [{ bearerAuth: [] }];

const jsonBody = (schema) => ({
  required: true,
  content: { "application/json": { schema } }
});

const standardResponses = {
  400: { description: "Invalid request" },
  401: { description: "Missing or invalid JWT" },
  500: { description: "Internal server error" }
};

const crudPaths = (name, schemaName) => ({
  get: {
    tags: [name],
    summary: `List ${name.toLowerCase()}`,
    security: bearerSecurity,
    responses: { 200: { description: "Records returned" }, ...standardResponses }
  },
  post: {
    tags: [name],
    summary: `Create ${name.toLowerCase()} record`,
    security: bearerSecurity,
    requestBody: jsonBody({ $ref: `#/components/schemas/${schemaName}` }),
    responses: { 201: { description: "Record created" }, ...standardResponses }
  }
});

const itemPaths = (name, schemaName) => ({
  put: {
    tags: [name], summary: `Replace ${name.toLowerCase()} record`, security: bearerSecurity,
    parameters: [{ $ref: "#/components/parameters/RecordId" }],
    requestBody: jsonBody({ $ref: `#/components/schemas/${schemaName}` }),
    responses: { 200: { description: "Record updated" }, 404: { description: "Not found" }, ...standardResponses }
  },
  patch: {
    tags: [name], summary: `Partially update ${name.toLowerCase()} record`, security: bearerSecurity,
    parameters: [{ $ref: "#/components/parameters/RecordId" }],
    requestBody: jsonBody({ type: "object" }),
    responses: { 200: { description: "Record updated" }, 404: { description: "Not found" }, ...standardResponses }
  },
  delete: {
    tags: [name], summary: `Delete ${name.toLowerCase()} record`, security: bearerSecurity,
    parameters: [{ $ref: "#/components/parameters/RecordId" }],
    responses: { 200: { description: "Record deleted" }, 404: { description: "Not found" }, ...standardResponses }
  }
});

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Kosha Financial Intelligence API",
    version: "3.0.0",
    description:
      "Full-stack personal-finance API with holistic financial-health assessment, expenses, budgets, investments, loans, explainable portfolio allocation, and a news-aware daily newsletter. Recommendations are educational, not financial advice."
  },
  servers: [{ url: "/", description: "Current deployment" }],
  tags: [
    { name: "System" }, { name: "Profile" }, { name: "Expenses" }, { name: "Budgets" },
    { name: "Goals" }, { name: "Investments" }, { name: "Loans" }, { name: "Analytics" },
    { name: "Expense Intelligence" },
    { name: "Market" }, { name: "Portfolio Intelligence" }, { name: "Financial Advisor" }
  ],
  paths: {
    "/health": {
      get: { tags: ["System"], summary: "Liveness and database status", responses: { 200: { description: "Service is alive" } } }
    },
    "/ready": {
      get: { tags: ["System"], summary: "Deployment readiness", responses: { 200: { description: "Ready" }, 503: { description: "Database unavailable" } } }
    },
    "/auth/session": {
      get: { tags: ["Profile"], summary: "Create or retrieve the JWT user", security: bearerSecurity, responses: { 200: { description: "Authenticated session" }, ...standardResponses } }
    },
    "/auth/demo": {
      post: { tags: ["Profile"], summary: "Create an eight-hour sample-data session when demo mode is enabled", responses: { 200: { description: "Demo token and sample workspace" }, 404: { description: "Demo mode disabled" }, ...standardResponses } }
    },
    "/profile": {
      get: { tags: ["Profile"], summary: "Get profile", security: bearerSecurity, responses: { 200: { description: "Profile" }, ...standardResponses } },
      put: { tags: ["Profile"], summary: "Update profile fields", security: bearerSecurity, requestBody: jsonBody({ type: "object" }), responses: { 200: { description: "Updated profile" }, ...standardResponses } }
    },
    "/expenses": crudPaths("Expenses", "Expense"),
    "/expenses/{id}": itemPaths("Expenses", "Expense"),
    "/expense-imports/screenshot": {
      post: {
        tags: ["Expense Intelligence"],
        summary: "Extract, classify, and automatically log expenses from a spending screenshot",
        description: "The PNG or JPEG image is sent server-side to the configured Grok model on xAI and is not persisted by Kosha. Extracted transactions are logged immediately; any category can be corrected later with PATCH /expenses/{id}.",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["screenshot"],
                properties: { screenshot: { type: "string", format: "binary" } }
              }
            }
          }
        },
        responses: { 201: { description: "Expenses extracted, classified, and logged" }, 200: { description: "Duplicate screenshot; existing logged expenses returned" }, 422: { description: "No transactions extracted" }, ...standardResponses }
      }
    },
    "/expense-analytics/classification": {
      get: {
        tags: ["Expense Intelligence"], summary: "Get need/want/luxury breakdown and savings estimates", security: bearerSecurity,
        parameters: [
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } }
        ],
        responses: { 200: { description: "Chart-ready analytics for selected, monthly, yearly, journey, and all-time periods" }, ...standardResponses }
      }
    },
    "/expense-analytics/classification/chart.svg": {
      get: {
        tags: ["Expense Intelligence"], summary: "Render the selected classification period as an SVG pie chart", security: bearerSecurity,
        responses: { 200: { description: "SVG pie chart", content: { "image/svg+xml": { schema: { type: "string" } } } }, ...standardResponses }
      }
    },
    "/budget": {
      ...crudPaths("Budgets", "Budget"),
      put: {
        tags: ["Budgets"], summary: "Upsert a monthly category budget", security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/Budget" }),
        responses: { 200: { description: "Budget updated" }, ...standardResponses }
      }
    },
    "/goals": crudPaths("Goals", "Goal"),
    "/goals/{id}": itemPaths("Goals", "Goal"),
    "/investments": crudPaths("Investments", "Investment"),
    "/investments/{id}": itemPaths("Investments", "Investment"),
    "/loans": crudPaths("Loans", "Loan"),
    "/loans/{id}": itemPaths("Loans", "Loan"),
    "/dashboard": {
      get: { tags: ["Analytics"], summary: "Get dashboard KPIs, charts, and display lists", security: bearerSecurity, responses: { 200: { description: "Dashboard snapshot" }, ...standardResponses } }
    },
    "/finance-summary": {
      get: { tags: ["Analytics"], summary: "Get rule-based financial alerts and insights", security: bearerSecurity, responses: { 200: { description: "Finance summary" }, ...standardResponses } }
    },
    "/advisor/assessment": {
      get: {
        tags: ["Financial Advisor"],
        summary: "Assess the complete recorded financial picture and return prioritized actions",
        description: "Combines income, actual spending, budget, emergency liquidity, debts, goals, investments, and portfolio targets into a transparent six-dimension health score.",
        security: bearerSecurity,
        responses: { 200: { description: "Educational whole-picture assessment", content: { "application/json": { schema: { $ref: "#/components/schemas/FinancialAssessment" } } } }, ...standardResponses }
      }
    },
    "/advisor/ai-insight": {
      post: {
        tags: ["Financial Advisor"],
        summary: "Explain the deterministic financial assessment with Grok",
        description: "Generates cautious plain-language guidance without recalculating values or recommending named securities.",
        security: bearerSecurity,
        responses: { 200: { description: "Structured AI explanation" }, 503: { description: "AI is unconfigured or rate-limited" }, ...standardResponses }
      }
    },
    "/inflation/calculate": {
      post: {
        tags: ["Financial Advisor"],
        summary: "Calculate a per-user inflation and investment projection",
        security: bearerSecurity,
        requestBody: jsonBody({
          type: "object",
          required: ["currentAmount", "years", "inflationRate", "expectedReturn"],
          properties: {
            currentAmount: { type: "number", exclusiveMinimum: 0 },
            years: { type: "integer", minimum: 1, maximum: 60 },
            inflationRate: { type: "number", minimum: 0, maximum: 30 },
            expectedReturn: { type: "number", minimum: 0, maximum: 50 },
            saveAssumptions: { type: "boolean", default: true }
          }
        }),
        responses: { 200: { description: "Deterministic inflation projection and saved assumptions" }, ...standardResponses }
      }
    },
    "/market-overview": {
      get: { tags: ["Market"], summary: "Get cached live or clearly marked demo market data", security: bearerSecurity, responses: { 200: { description: "Market overview" }, ...standardResponses } }
    },
    "/portfolio/recommendation": {
      post: {
        tags: ["Portfolio Intelligence"], summary: "Submit questionnaire and create an allocation", security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/PortfolioQuestionnaire" }),
        responses: { 201: { description: "Explainable educational allocation" }, ...standardResponses }
      },
      get: { tags: ["Portfolio Intelligence"], summary: "Get saved recommendation and current-vs-target allocation", security: bearerSecurity, responses: { 200: { description: "Portfolio recommendation" }, 404: { description: "Questionnaire not completed" }, ...standardResponses } }
    },
    "/portfolio/newsletter/current": {
      get: { tags: ["Portfolio Intelligence"], summary: "Get today's newsletter and shouldDisplay unread flag", security: bearerSecurity, parameters: [{ name: "refresh", in: "query", schema: { type: "boolean" } }], responses: { 200: { description: "Daily portfolio newsletter" }, ...standardResponses } }
    },
    "/portfolio/newsletter/{id}/read": {
      post: { tags: ["Portfolio Intelligence"], summary: "Mark a newsletter as read", security: bearerSecurity, parameters: [{ $ref: "#/components/parameters/RecordId" }], responses: { 200: { description: "Newsletter acknowledged" }, 404: { description: "Not found" }, ...standardResponses } }
    }
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    parameters: { RecordId: { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } } },
    schemas: {
      Expense: {
        type: "object", required: ["amount", "category", "description", "date"],
        properties: { amount: { type: "number", exclusiveMinimum: 0 }, category: { type: "string" }, description: { type: "string" }, merchant: { type: "string" }, tags: { type: "array", items: { type: "string" } }, notes: { type: "string" }, date: { type: "string", format: "date-time" }, recurring: { type: "boolean" }, necessityType: { enum: ["needs", "wants", "luxury", "uncategorized"] }, potentialSavings: { type: "number", readOnly: true } }
      },
      FinancialAssessment: {
        type: "object",
        properties: {
          generatedAt: { type: "string", format: "date-time" },
          health: {
            type: "object",
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              band: { enum: ["strong", "stable", "needs_attention", "vulnerable"] },
              dimensions: { type: "array", items: { type: "object" } }
            }
          },
          snapshot: { type: "object" },
          actions: { type: "array", items: { type: "object" } },
          portfolio: { type: ["object", "null"] },
          dataCompleteness: { type: "object" },
          assumptions: { type: "array", items: { type: "string" } },
          disclaimer: { type: "string" }
        }
      },
      Budget: {
        type: "object", required: ["amount", "month"],
        properties: { amount: { type: "number", minimum: 0 }, category: { type: "string", default: "overall" }, month: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, alertThreshold: { type: "number", minimum: 1, maximum: 100 } }
      },
      Goal: {
        type: "object", required: ["title", "targetAmount", "targetDate"],
        properties: { title: { type: "string" }, goalType: { type: "string" }, targetAmount: { type: "number" }, currentAmount: { type: "number" }, monthlyContribution: { type: "number" }, expectedReturn: { type: "number" }, priority: { enum: ["low", "medium", "high"] }, targetDate: { type: "string", format: "date-time" }, status: { enum: ["planned", "active", "completed", "paused"] } }
      },
      Investment: {
        type: "object", required: ["assetName", "assetType", "amountInvested", "currentValue", "purchaseDate"],
        properties: { assetName: { type: "string" }, assetType: { type: "string" }, symbol: { type: "string" }, platform: { type: "string" }, amountInvested: { type: "number" }, currentValue: { type: "number" }, units: { type: "number" }, riskLevel: { enum: ["low", "moderate", "high"] }, purchaseDate: { type: "string", format: "date-time" } }
      },
      Loan: {
        type: "object", required: ["lender", "loanType", "principalAmount", "outstandingAmount", "emi", "interestRate", "nextDueDate"],
        properties: { lender: { type: "string" }, loanType: { type: "string" }, principalAmount: { type: "number" }, outstandingAmount: { type: "number" }, emi: { type: "number" }, interestRate: { type: "number" }, tenureMonths: { type: "number" }, nextDueDate: { type: "string", format: "date-time" }, secured: { type: "boolean" }, status: { enum: ["active", "closed", "delayed"] } }
      },
      PortfolioQuestionnaire: {
        type: "object",
        required: ["age", "monthlyIncome", "monthlyEssentialExpenses", "investmentHorizonYears", "riskTolerance", "incomeStability", "investmentExperience"],
        properties: {
          age: { type: "integer", minimum: 18, maximum: 100 }, dependents: { type: "integer", minimum: 0 },
          monthlyIncome: { type: "number", exclusiveMinimum: 0 }, monthlyEssentialExpenses: { type: "number", minimum: 0 },
          monthlyDebtPayments: { type: "number", minimum: 0 }, liquidSavings: { type: "number", minimum: 0 },
          investmentHorizonYears: { type: "integer", minimum: 1, maximum: 50 },
          riskTolerance: { enum: ["conservative", "balanced", "growth"] }, incomeStability: { enum: ["unstable", "variable", "stable"] },
          investmentExperience: { enum: ["beginner", "intermediate", "experienced"] }, hasHealthInsurance: { type: "boolean" },
          hasTermInsurance: { type: "boolean" }, goals: { type: "array", items: { type: "string" } },
          preferredRealEstateAllocation: { type: "number", minimum: 0, maximum: 30 }
        }
      }
    }
  }
};
