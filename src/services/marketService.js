import { env } from "../config/env.js";

const demoBoard = [
  { name: "Nifty 50", symbol: "NSEI", points: 22485.65, change: 126.4, changePercent: 0.57, simulated: true },
  { name: "Sensex", symbol: "BSESN", points: 73912.1, change: 401.78, changePercent: 0.55, simulated: true },
  { name: "Bank Nifty", symbol: "NSEBANK", points: 48110.3, change: -85.2, changePercent: -0.18, simulated: true },
  { name: "USD/INR", symbol: "USDINR", points: 83.11, change: 0.14, changePercent: 0.17, simulated: true }
];

const demoHeadlines = [
  {
    title: "Market context is in demo mode until a market-data API key is configured.",
    source: "Finance API Demo",
    url: "",
    summary: "Treat these sample headlines as interface placeholders, not current financial news.",
    publishedAt: null,
    sentiment: "Neutral",
    simulated: true
  },
  {
    title: "Diversification and liquidity should be reviewed together.",
    source: "Finance API Demo",
    url: "",
    summary: "A portfolio can be difficult to use in an emergency when too much is held in illiquid assets.",
    publishedAt: null,
    sentiment: "Neutral",
    simulated: true
  }
];

const cache = new Map();

const getCached = (key) => {
  const item = cache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
};

const setCached = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + env.marketCacheTtlMs });
  return value;
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.marketRequestTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "finance-portfolio-api/1.0" }
    });
    if (!response.ok) throw new Error(`Market provider returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.Note || payload.Information || payload["Error Message"]) {
      throw new Error("Market provider rejected or throttled the request");
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

const parseWatchlist = () =>
  env.marketQuoteSymbols
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, symbol] = entry.split("|");
      return { name: name?.trim() || symbol?.trim() || entry, symbol: symbol?.trim() || name?.trim() || entry };
    });

const normalizeHeadline = (item) => ({
  title: item.title,
  source: item.source,
  url: item.url,
  summary: item.summary,
  publishedAt: item.time_published,
  sentiment: item.overall_sentiment_label || "Neutral",
  tickerSentiment: (item.ticker_sentiment || []).map((entry) => ({
    ticker: entry.ticker,
    relevanceScore: Number(entry.relevance_score || 0),
    sentiment: entry.ticker_sentiment_label || "Neutral"
  })),
  simulated: false
});

const getNewsFeed = async ({ tickers = [], topics = [] } = {}) => {
  const normalizedTickers = [...new Set(tickers.map((item) => String(item).trim().toUpperCase()).filter(Boolean))].slice(0, 5);
  const normalizedTopics = [...new Set(topics.map((item) => String(item).trim()).filter(Boolean))].slice(0, 3);
  const key = `news:${normalizedTickers.join(",")}:${normalizedTopics.join(",")}`;
  const cached = getCached(key);
  if (cached) return cached;

  const url = new URL(env.marketDataUrl);
  url.searchParams.set("function", "NEWS_SENTIMENT");
  if (normalizedTickers.length) url.searchParams.set("tickers", normalizedTickers.join(","));
  if (normalizedTopics.length) url.searchParams.set("topics", normalizedTopics.join(","));
  url.searchParams.set("sort", "LATEST");
  url.searchParams.set("limit", "10");
  url.searchParams.set("apikey", env.marketDataApiKey);

  const payload = await fetchJson(url);
  return setCached(key, (payload.feed || []).slice(0, 10).map(normalizeHeadline));
};

const getQuote = async (symbol) => {
  const key = `quote:${symbol}`;
  const cached = getCached(key);
  if (cached) return cached;

  const url = new URL(env.marketDataUrl);
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", env.marketDataApiKey);
  const payload = await fetchJson(url);
  const quote = payload["Global Quote"];
  if (!quote || !quote["05. price"]) return null;

  return setCached(key, {
    points: Number(quote["05. price"]),
    change: Number(quote["09. change"]),
    changePercent: Number(String(quote["10. change percent"]).replace("%", ""))
  });
};

export const getPortfolioNews = async ({ tickers = [], topics = [] } = {}) => {
  if (!env.marketDataApiKey || env.marketFeedMode === "demo") {
    return { mode: "demo", headlines: demoHeadlines };
  }

  try {
    const headlines = await getNewsFeed({
      tickers,
      topics: topics.length ? topics : env.marketNewsTopics.split(",")
    });
    return { mode: "live", headlines: headlines.length ? headlines : demoHeadlines };
  } catch {
    return { mode: "demo", headlines: demoHeadlines };
  }
};

export const getMarketOverviewSnapshot = async () => {
  const cached = getCached("overview");
  if (cached) return cached;

  if (!env.marketDataApiKey || env.marketFeedMode === "demo") {
    return setCached("overview", {
      mode: "demo",
      updatedAt: new Date().toISOString(),
      indices: demoBoard,
      headlines: demoHeadlines,
      disclaimer: "Demo values are simulated and must not be used for investment decisions."
    });
  }

  try {
    const watchlist = parseWatchlist();
    const [headlines, quoteResults] = await Promise.all([
      getNewsFeed({ topics: env.marketNewsTopics.split(",") }),
      Promise.allSettled(watchlist.map((item) => getQuote(item.symbol)))
    ]);
    const indices = watchlist.map((item, index) => {
      const result = quoteResults[index];
      const quote = result.status === "fulfilled" ? result.value : null;
      return {
        name: item.name,
        symbol: item.symbol,
        points: quote?.points ?? null,
        change: quote?.change ?? null,
        changePercent: quote?.changePercent ?? null,
        simulated: !quote
      };
    });
    return setCached("overview", {
      mode: "live",
      updatedAt: new Date().toISOString(),
      indices,
      headlines: headlines.length ? headlines : demoHeadlines,
      disclaimer: "Market information may be delayed. Verify prices with an authorized market-data source."
    });
  } catch {
    return setCached("overview", {
      mode: "demo",
      updatedAt: new Date().toISOString(),
      indices: demoBoard,
      headlines: demoHeadlines,
      disclaimer: "Live market data was unavailable; simulated values are shown."
    });
  }
};

export const clearMarketCache = () => cache.clear();
