import dotenv from "dotenv";

dotenv.config();

const required = ["JWT_SECRET", "DB_URI", "PORT"];

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
  marketDataApiKey: process.env.MARKET_DATA_API_KEY || "",
  marketDataUrl: process.env.MARKET_DATA_URL || "https://www.alphavantage.co/query",
  marketFeedMode: process.env.MARKET_FEED_MODE || "demo",
  marketQuoteSymbols:
    process.env.MARKET_QUOTE_SYMBOLS ||
    "Nifty 50|NSEI,Sensex|BSESN,Bank Nifty|NSEBANK,USD/INR|USDINR",
  marketNewsTopics: process.env.MARKET_NEWS_TOPICS || "financial_markets"
};
