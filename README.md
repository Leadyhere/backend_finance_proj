# Kosha — Personal Financial Intelligence

[![CI](https://github.com/Leadyhere/backend_finance_proj/actions/workflows/ci.yml/badge.svg)](https://github.com/Leadyhere/backend_finance_proj/actions/workflows/ci.yml)

A production-capable full-stack application for understanding personal finances, generating explainable whole-picture guidance, tracking expenses from screenshots, building portfolio-allocation targets, and presenting a daily news-aware investment briefing.

The allocation engine is deterministic and auditable: every percentage comes with a rationale based on liquidity, time horizon, income stability, dependents, experience, and stated risk tolerance. It does not execute trades and does not present itself as regulated financial advice.

## Portfolio highlights

- Professional responsive frontend served by the same Express deployment, with no separate frontend build or dependency tree
- Six-dimension financial-health score across cash flow, emergency readiness, debt, spending, goals, and portfolio alignment
- Prioritized, amount-specific actions generated from the user's complete recorded financial background
- JWT-protected, user-isolated expense, budget, goal, investment, and loan APIs
- Correct full-dataset dashboard aggregation with six-month and weekly trends
- Explainable six-bucket portfolio targets: equity mutual funds, debt mutual funds, liquid assets, land/real estate, gold, and emergency funds
- Emergency-fund target and monthly-surplus analysis
- Current-versus-target allocation and rebalancing gap calculation
- Daily persisted newsletter with current portfolio flags, market headlines, and unread state
- Grok vision screenshot-to-expense extraction with automatic classification and optional corrections afterward
- Per-user inflation calculator with saved inflation and return assumptions
- Optional Grok explanation of the deterministic whole-picture action plan
- Need, want, luxury/materialistic, and unclassified analytics with monthly, yearly, and investment-journey savings estimates
- Chart-ready JSON and an authenticated SVG pie-chart endpoint
- Live Alpha Vantage-compatible news/quotes with timeout, caching, throttling detection, and explicit demo fallback
- Swagger UI, OpenAPI 3.1, Docker Compose, migration and seed commands
- Structured redacted logs, optional Sentry error reporting, health/readiness endpoints, rate limiting, CORS, Helmet, and input sanitization
- Unit and API integration tests backed by an ephemeral MongoDB instance

## Architecture

```text
Responsive browser application
      │ Bearer JWT
      ▼
Express middleware ── request ID, logs, security, validation, rate limits
      │
      ▼
Routes → Controllers → Finance / Portfolio / Market services
                              │                 │
                              ▼                 ▼
                           MongoDB       Market-data API
```

See [docs/architecture.md](docs/architecture.md) for the component and data-flow details.

## Main API areas

| Area | Routes |
|---|---|
| System | `GET /`, `GET /api`, `GET /health`, `GET /ready`, `GET /docs`, `GET /openapi.json` |
| Session/profile | `POST /auth/demo`, `GET /auth/session`, `GET/PUT /profile` |
| Expenses | `POST/GET /expenses`, `PUT/PATCH/DELETE /expenses/:id` |
| Screenshot imports | `POST /expense-imports/screenshot` |
| Spending intelligence | `GET /expense-analytics/classification`, `GET /expense-analytics/classification/chart.svg` |
| Budgets | `POST/GET/PUT /budget` |
| Goals | `POST/GET /goals`, `PUT/PATCH/DELETE /goals/:id` |
| Investments | `POST/GET /investments`, `PUT/PATCH/DELETE /investments/:id` |
| Loans | `POST/GET /loans`, `PUT/PATCH/DELETE /loans/:id` |
| Analytics | `GET /dashboard`, `GET /finance-summary`, `GET /advisor/assessment` |
| AI advisor | `POST /advisor/ai-insight` |
| Inflation planning | `POST /inflation/calculate` |
| Market | `GET /market-overview` |
| Portfolio intelligence | `POST/GET /portfolio/recommendation` |
| Daily briefing | `GET /portfolio/newsletter/current`, `POST /portfolio/newsletter/:id/read` |

All financial routes require an `Authorization: Bearer <jwt>` header. The JWT must contain a string `user_id` claim and be signed with HS256 using the configured secret. `POST /auth/demo` is available only when `DEMO_MODE=true`; it creates an expiring sample session for portfolio demonstrations. Production identity can remain with the calling application or an external identity provider.

## Quick start

Requirements: Node.js 20+ and MongoDB 7+.

```bash
git clone https://github.com/Leadyhere/backend_finance_proj.git
cd backend_finance_proj
npm ci
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env`.

Open:

- Interactive application: `http://localhost:5001/`
- API overview: `http://localhost:5001/api`
- Interactive Swagger documentation: `http://localhost:5001/docs`
- Liveness: `http://localhost:5001/health`
- Readiness: `http://localhost:5001/ready`

For a complete local stack:

```bash
docker compose up --build
```

## Environment

| Variable | Required | Purpose |
|---|---:|---|
| `JWT_SECRET` | Yes | HS256 token verification secret |
| `DB_URI` | Yes | MongoDB connection URI |
| `PORT` | No | HTTP port; defaults to `5001` |
| `CLIENT_URL` | No | Allowed browser origin |
| `LOG_LEVEL` | No | Pino log level |
| `SENTRY_DSN` | No | Enables Sentry error reporting |
| `SENTRY_TRACES_SAMPLE_RATE` | No | Optional tracing sample rate |
| `DEMO_MODE` | No | Enables the rate-limited resume demonstration session; defaults to `false` |
| `MARKET_DATA_API_KEY` | No | Enables live market/news mode |
| `MARKET_DATA_URL` | No | Alpha Vantage-compatible endpoint |
| `MARKET_FEED_MODE` | No | `demo` or `live` |
| `MARKET_REQUEST_TIMEOUT_MS` | No | Provider request timeout |
| `MARKET_CACHE_TTL_MS` | No | In-memory market response TTL |
| `MARKET_QUOTE_SYMBOLS` | No | Display-name and provider-symbol pairs |
| `MARKET_NEWS_TOPICS` | No | Provider-supported news topics |
| `XAI_API_KEY` | For Grok features | Server-side xAI key; never exposed to the browser |
| `XAI_MODEL` | No | Grok vision and structured-output model; defaults to `grok-4.6` |
| `XAI_REQUEST_TIMEOUT_MS` | No | Grok request timeout; defaults to 30 seconds |

## Whole-picture financial advisor

`GET /advisor/assessment` combines the user's saved income profile, three-month spending pattern, budget, need/want/luxury classification, possible savings, active EMIs and interest rates, emergency liquidity, goals, investments, and saved portfolio questionnaire.

It returns:

- a weighted financial-health score from 0–100;
- six independently explained health dimensions;
- a consolidated cash-flow, debt, savings, goal, and portfolio snapshot;
- prioritized actions with their rationale and suggested monthly amount;
- current-versus-target portfolio gaps;
- data-completeness checks and explicit calculation assumptions.

The scoring and calculations are deterministic and inspectable. `POST /advisor/ai-insight` can optionally ask Grok to explain that existing assessment in plain language; it cannot change the numbers, execute transactions, promise returns, or represent itself as a SEBI-registered adviser.

## Portfolio questionnaire example

```json
{
  "age": 31,
  "dependents": 1,
  "monthlyIncome": 120000,
  "monthlyEssentialExpenses": 50000,
  "monthlyDebtPayments": 10000,
  "liquidSavings": 150000,
  "investmentHorizonYears": 10,
  "riskTolerance": "balanced",
  "incomeStability": "stable",
  "investmentExperience": "intermediate",
  "hasHealthInsurance": true,
  "hasTermInsurance": true,
  "goals": ["Retirement", "Home purchase"],
  "preferredRealEstateAllocation": 10
}
```

The response contains the risk score, allocation totaling 100%, emergency-fund gap, rationale, warnings, current allocation, and target differences. Land allocation is automatically deferred when the time horizon, emergency liquidity, or monthly surplus is insufficient.

## Screenshot expense import

Upload a PNG or JPEG spending screenshot using multipart form field `screenshot`:

```bash
curl -X POST http://localhost:5001/expense-imports/screenshot \
  -H "Authorization: Bearer $TOKEN" \
  -F "screenshot=@daily-spending.png"
```

The API sends the image directly from server memory to the configured Grok vision model on xAI, requests schema-validated transaction data, and immediately logs the extracted expenses. Kosha does **not** persist the original screenshot, and the API key is never sent to the browser. Each item is classified as:

- `needs` — housing, groceries, utilities, healthcare, education, insurance, and core transport;
- `wants` — discretionary dining, streaming, shopping, convenience transport, and personal care;
- `luxury` — explicitly premium, status, or highly discretionary purchases; or
- `uncategorized` — anything the rules cannot classify confidently.

No confirmation or category-selection prompt is required. The upload response returns `loggedExpenses`, and the website can offer an optional Edit action for each result. Correct a category, necessity type, description, merchant, amount, or date afterward with `PATCH /expenses/:id`; changing the amount or necessity type also recalculates potential savings.

`GET /expense-analytics/classification` returns pie-chart data, current-month and current-year actual potential savings, average monthly and annualized potential savings, and actual potential savings since the earliest recorded investment purchase. The authenticated `.svg` endpoint renders the same breakdown as a pie chart.

The transparent default assumption counts 50% of wants and 80% of luxury spending as potentially avoidable. Needs and unclassified expenses count as zero. These are behavioral estimates, not guaranteed savings.

## Newsletter website behavior

When the authenticated website loads, request `GET /portfolio/newsletter/current`. Display a banner or modal only when the response contains `shouldDisplay: true`. After the user reads or dismisses it, call `POST /portfolio/newsletter/:id/read`.

The server stores one newsletter per user per UTC day, so refreshing the page does not create duplicates. See [docs/frontend-integration.md](docs/frontend-integration.md) for sample browser code.

News sentiment is context only. The engine never changes a long-term allocation solely because of a headline.

## Quality commands

```bash
npm run check
npm test
npm audit --omit=dev
npm run build
```

CI performs the checks above. Tests cover authentication boundaries, demo bootstrap, whole-picture advice, inflation projections, AI structured-output requests and unconfigured-key behavior, expense CRUD and partial updates, full-dataset dashboard totals, allocation invariants, land-liquidity rules, the newsletter lifecycle, screenshot logging, post-import category correction, savings analytics, SVG rendering, modal dismissal, and upload validation.

## Deployment

- `Dockerfile` provides a reproducible non-root Node 20 image with an application health check.
- `docker-compose.yml` starts the API and MongoDB locally.
- `render.yaml` deploys the complete frontend and API as one Render web service and waits for CI checks before automatic deployment. Supply MongoDB Atlas or another production MongoDB URI through `DB_URI`.
- `/ready` returns HTTP 503 until MongoDB is reachable.
- Run `npm run migrate` once during a deployment before serving traffic.

## Security and limitations

- Rotate any credential that has ever appeared in Git history; deleting `.env` in a later commit is not sufficient.
- Market data may be delayed and depends on provider symbol support and plan limits.
- The in-memory market cache is suitable for a single instance; multi-instance deployments should use Redis or another shared cache.
- Financial calculations use the data supplied by the user and do not include taxes, product fees, or suitability verification by a licensed adviser. Inflation projections assume fixed rates.
- Grok extraction is best-effort and sends screenshots to xAI. Automatically logged expenses remain editable and can also be deleted through the normal expense API.
- No software license has been selected yet.

Review [SECURITY.md](SECURITY.md) before reporting a vulnerability.
