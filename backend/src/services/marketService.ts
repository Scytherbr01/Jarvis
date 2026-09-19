import { config } from "../config.js";

export interface TickerSnapshot {
  symbol: string;
  price: number;
  changePercent: number;
  fiftyDayAvg?: number;
  trend: "bullish" | "bearish" | "neutral";
  note: string;
}

export interface MarketBrief {
  generatedAt: string;
  tickers: TickerSnapshot[];
  advice: string;
}

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

interface GlobalQuoteResponse {
  "Global Quote"?: {
    "01. symbol": string;
    "05. price": string;
    "10. change percent": string;
  };
}

interface SmaResponse {
  "Technical Analysis: SMA"?: Record<string, { SMA: string }>;
}

async function fetchQuote(symbol: string): Promise<{ price: number; changePercent: number } | null> {
  const url = `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${config.alphaVantageApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as GlobalQuoteResponse;
  const quote = data["Global Quote"];
  if (!quote) return null;
  return {
    price: Number(quote["05. price"]),
    changePercent: Number(quote["10. change percent"].replace("%", "")),
  };
}

async function fetch50DaySma(symbol: string): Promise<number | undefined> {
  const url = `${ALPHA_VANTAGE_BASE}?function=SMA&symbol=${symbol}&interval=daily&time_period=50&series_type=close&apikey=${config.alphaVantageApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return undefined;
  const data = (await res.json()) as SmaResponse;
  const series = data["Technical Analysis: SMA"];
  if (!series) return undefined;
  const latestDate = Object.keys(series).sort().at(-1);
  if (!latestDate) return undefined;
  return Number(series[latestDate].SMA);
}

function classifyTrend(changePercent: number, price: number, sma?: number): TickerSnapshot["trend"] {
  if (sma !== undefined) {
    if (price > sma * 1.02) return "bullish";
    if (price < sma * 0.98) return "bearish";
    return "neutral";
  }
  if (changePercent > 1) return "bullish";
  if (changePercent < -1) return "bearish";
  return "neutral";
}

function noteFor(symbol: string, trend: TickerSnapshot["trend"], changePercent: number): string {
  const move = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}% today`;
  switch (trend) {
    case "bullish":
      return `${symbol} is trading above its 50-day average (${move}) — momentum favors the bulls, but confirm with volume before adding.`;
    case "bearish":
      return `${symbol} is trading below its 50-day average (${move}) — watch for further downside before catching this knife.`;
    default:
      return `${symbol} is trading near its 50-day average (${move}) — no strong signal either way.`;
  }
}

/**
 * NOT financial advice. This produces a simple, rules-based trend read
 * (price vs. 50-day SMA) intended as a conversation-starter for your own
 * research, not a recommendation to buy or sell anything.
 */
export async function getMarketBrief(watchlist: string[] = config.defaultWatchlist): Promise<MarketBrief> {
  const tickers: TickerSnapshot[] = [];

  for (const symbol of watchlist) {
    const quote = await fetchQuote(symbol);
    if (!quote) continue;
    const sma = await fetch50DaySma(symbol);
    const trend = classifyTrend(quote.changePercent, quote.price, sma);
    tickers.push({
      symbol,
      price: quote.price,
      changePercent: quote.changePercent,
      fiftyDayAvg: sma,
      trend,
      note: noteFor(symbol, trend, quote.changePercent),
    });
  }

  const bullish = tickers.filter((t) => t.trend === "bullish").length;
  const bearish = tickers.filter((t) => t.trend === "bearish").length;
  const advice =
    bullish === 0 && bearish === 0
      ? "Your watchlist is flat today — no strong trend signals to act on."
      : bullish >= bearish
        ? `${bullish} of ${tickers.length} watchlist names are trending up. Broadly constructive, but this is a simple trend read, not investment advice — size any moves to your own risk tolerance.`
        : `${bearish} of ${tickers.length} watchlist names are trending down. Consider tightening risk, but this is a simple trend read, not investment advice.`;

  return {
    generatedAt: new Date().toISOString(),
    tickers,
    advice,
  };
}
