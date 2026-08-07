# Personal Finance API

A production-oriented REST API foundation for personal-finance applications, built with Node.js, Express, MongoDB, and JWT authentication.

> **Security notice:** configure secrets through a local `.env` file or deployment secret manager. Never commit credentials or API keys.

## Highlights

- Express API with MongoDB persistence through Mongoose
- JWT-based authentication support
- Security middleware for headers, rate limiting, input sanitization, compression, CORS, and request logging
- Configurable live or demo market-data feed
- Docker-ready runtime with graceful shutdown handling

## Tech Stack

- Node.js 20+ and Express
- MongoDB and Mongoose
- JSON Web Tokens
- Docker

## Getting Started

```bash
git clone https://github.com/Leadyhere/backend_finance_proj.git
cd backend_finance_proj
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

## Environment Variables

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Secret used to sign authentication tokens |
| `DB_URI` | MongoDB connection string |
| `PORT` | API port; defaults to `5001` |
| `CLIENT_URL` | Allowed frontend origin |
| `MARKET_DATA_API_KEY` | Optional provider key for live market data |
| `MARKET_DATA_URL` | Market-data provider endpoint |
| `MARKET_FEED_MODE` | `demo` or `live` |
| `MARKET_QUOTE_SYMBOLS` | Symbols displayed by the market feed |
| `MARKET_NEWS_TOPICS` | News topics requested from the provider |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API with automatic reload |
| `npm start` | Start the API normally |

## Docker

```bash
docker build -t personal-finance-api .
docker run --env-file .env -p 5001:5001 personal-finance-api
```

## Project Status

This repository is an actively developed backend module. Before production use, add automated API tests, request/response documentation, centralized error reporting, and deployment-specific secret management.

## License

No license has been selected yet.
