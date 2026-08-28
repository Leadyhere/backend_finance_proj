import dotenv from "dotenv";

dotenv.config();

const required = ["JWT_SECRET", "DB_URI"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  jwtSecret: process.env.JWT_SECRET,
  dbUri: process.env.DB_URI,
  port: Number(process.env.PORT) || 5001,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  logLevel: process.env.LOG_LEVEL || "info",
  sentryDsn: process.env.SENTRY_DSN || "",
  sentryTracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
  demoMode: process.env.DEMO_MODE === "true",
  marketDataApiKey: process.env.MARKET_DATA_API_KEY || "",
  marketDataUrl: process.env.MARKET_DATA_URL || "https://www.alphavantage.co/query",
  marketFeedMode: process.env.MARKET_FEED_MODE || "demo",
  marketRequestTimeoutMs: Number(process.env.MARKET_REQUEST_TIMEOUT_MS) || 5000,
  marketCacheTtlMs: Number(process.env.MARKET_CACHE_TTL_MS) || 300000,
  xAiApiKey: process.env.XAI_API_KEY || "",
  xAiModel: process.env.XAI_MODEL || "grok-4.6",
  xAiRequestTimeoutMs:
    Number(process.env.XAI_REQUEST_TIMEOUT_MS) || 30000,
  marketQuoteSymbols:
    process.env.MARKET_QUOTE_SYMBOLS ||
    "Nifty 50|NSEI,Sensex|BSESN,Bank Nifty|NSEBANK,USD/INR|USDINR",
  marketNewsTopics: process.env.MARKET_NEWS_TOPICS || "financial_markets"
};
