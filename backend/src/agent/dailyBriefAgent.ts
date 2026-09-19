import { getImportantEmails, type EmailHighlight, type GmailTokens } from "../services/gmailService.js";
import { getMarketBrief, type MarketBrief } from "../services/marketService.js";
import { getTopHeadlines, type NewsHeadline } from "../services/newsService.js";
import { CONNECTIONS } from "../services/connections.js";

export interface DailyBrief {
  generatedAt: string;
  greeting: string;
  emails: EmailHighlight[];
  market: MarketBrief;
  headlines: NewsHeadline[];
  connections: typeof CONNECTIONS;
}

export interface DailyBriefInput {
  gmailTokens?: GmailTokens;
  watchlist?: string[];
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The single entry point the API, the cron scheduler, and the CLI script
 * all call. This is "the daily brief routine" — one function that
 * gathers email, market, and news signal and returns one payload the
 * iOS app renders and/or gets pushed as a notification.
 */
export async function runDailyBrief(input: DailyBriefInput): Promise<DailyBrief> {
  const [emails, market, headlines] = await Promise.all([
    input.gmailTokens ? getImportantEmails(input.gmailTokens) : Promise.resolve([]),
    getMarketBrief(input.watchlist),
    getTopHeadlines(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    greeting: greetingForNow(),
    emails,
    market,
    headlines,
    connections: CONNECTIONS,
  };
}
