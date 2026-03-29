import { env } from "../config/env.js";

const demoBoard = [
  {
    name: "Nifty 50",
    symbol: "NSEI",
    points: 22485.65,
    change: 126.4,
    changePercent: 0.57,
    simulated: true
  },
  {
    name: "Sensex",
    symbol: "BSESN",
    points: 73912.1,
    change: 401.78,
    changePercent: 0.55,
    simulated: true
  },
  {
    name: "Bank Nifty",
    symbol: "NSEBANK",
    points: 48110.3,
    change: -85.2,
    changePercent: -0.18,
    simulated: true
  },
  {
    name: "USD/INR",
    symbol: "USDINR",
    points: 83.11,
    change: 0.14,
    changePercent: 0.17,
    simulated: true
  }
];

const demoHeadlines = [
  {
    title: "Markets are balancing rate expectations with sector earnings momentum.",
    source: "Market Desk",
    url: "",
    summary: "Track broad market sentiment alongside your own spending, loan, and investment decisions.",
    publishedAt: new Date().toISOString()
  },
  {
    title: "Financial discipline works best when budgeting and investing move together.",
    source: "Market Desk",
    url: "",
    summary: "Use portfolio and liability views together for sharper financial planning.",
    publishedAt: new Date().toISOString()
  },
  {
    title: "Indian benchmark indices remain a useful pulse check for daily portfolio context.",
    source: "Market Desk",
    url: "",
    summary: "Keep an eye on benchmark movement while reviewing goals, EMIs, and allocation decisions.",
    publishedAt: new Date().toISOString()
  }
];

const parseWatchlist = () =>
  env.marketQuoteSymbols
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, symbol] = entry.split("|");
      return {
        name: name?.trim() || symbol?.trim() || entry,
        symbol: symbol?.trim() || name?.trim() || entry
      };
    });

const getNewsFeed = async () => {
  const url = new URL(env.marketDataUrl);
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("topics", env.marketNewsTopics);
  url.searchParams.set("sort", "LATEST");
  url.searchParams.set("limit", "5");
  url.searchParams.set("apikey", env.marketDataApiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Market news fetch failed");
  }

  const payload = await response.json();
  return (payload.feed || []).slice(0, 5).map((item) => ({
    title: item.title,
    source: item.source,
    url: item.url,
    summary: item.summary,
    publishedAt: item.time_published
  }));
};

const getQuote = async (symbol) => {
  const url = new URL(env.marketDataUrl);
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", env.marketDataApiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Market quote fetch failed for ${symbol}`);
  }

  const payload = await response.json();
  const quote = payload["Global Quote"];

  if (!quote || !quote["05. price"]) {
    return null;
  }

  return {
    points: Number(quote["05. price"]),
    change: Number(quote["09. change"]),
    changePercent: Number(String(quote["10. change percent"]).replace("%", ""))
  };
};

export const getMarketOverviewSnapshot = async () => {
  if (!env.marketDataApiKey || env.marketFeedMode === "demo") {
    return {
      mode: "demo",
      updatedAt: new Date().toISOString(),
      indices: demoBoard,
      headlines: demoHeadlines,
      disclaimer: ""
    };
  }

  try {
    const watchlist = parseWatchlist();
    const [headlines, quotes] = await Promise.all([
      getNewsFeed(),
      Promise.all(watchlist.map((item) => getQuote(item.symbol)))
    ]);

    const indices = watchlist.map((item, index) => {
      const quote = quotes[index];
      return {
        name: item.name,
        symbol: item.symbol,
        points: quote?.points ?? null,
        change: quote?.change ?? null,
        changePercent: quote?.changePercent ?? null,
        simulated: !quote
      };
    });

    return {
      mode: "live",
      updatedAt: new Date().toISOString(),
      indices,
      headlines: headlines.length > 0 ? headlines : demoHeadlines,
      disclaimer: ""
    };
  } catch {
    return {
      mode: "demo",
      updatedAt: new Date().toISOString(),
      indices: demoBoard,
      headlines: demoHeadlines,
      disclaimer: ""
    };
  }
};
