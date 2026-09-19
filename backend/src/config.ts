import "dotenv/config";

function requireEnvList(name: string): string[] {
  const raw = process.env[name] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  apiKeys: requireEnvList("JARVIS_API_KEYS"),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "jarvis://oauth/gmail/callback",
  },

  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY ?? "",
  defaultWatchlist: requireEnvList("DEFAULT_WATCHLIST").length
    ? requireEnvList("DEFAULT_WATCHLIST")
    : ["AAPL", "MSFT", "SPY", "QQQ"],

  newsApiKey: process.env.NEWS_API_KEY ?? "",

  apns: {
    keyId: process.env.APNS_KEY_ID ?? "",
    teamId: process.env.APNS_TEAM_ID ?? "",
    bundleId: process.env.APNS_BUNDLE_ID ?? "",
    privateKeyPath: process.env.APNS_PRIVATE_KEY_PATH ?? "",
  },

  dailyBriefCron: process.env.DAILY_BRIEF_CRON ?? "0 7 * * *",
};
