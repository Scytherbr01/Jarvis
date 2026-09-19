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
    // Optional: a refresh token so the unattended alert-check cron can
    // read Gmail without the app being open. Get one by connecting Gmail
    // in the app once, then copying the refreshToken it received (logged
    // once at connect time if GMAIL_LOG_REFRESH_TOKEN=true) into this var.
    // Without it, the cron still checks market-move alerts — it just
    // skips the urgent-email check.
    serverRefreshToken: process.env.GMAIL_SERVER_REFRESH_TOKEN ?? "",
  },

  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY ?? "",
  defaultWatchlist: requireEnvList("DEFAULT_WATCHLIST").length
    ? requireEnvList("DEFAULT_WATCHLIST")
    : ["AAPL", "MSFT", "SPY", "QQQ"],

  newsApiKey: process.env.NEWS_API_KEY ?? "",

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  },

  apns: {
    keyId: process.env.APNS_KEY_ID ?? "",
    teamId: process.env.APNS_TEAM_ID ?? "",
    bundleId: process.env.APNS_BUNDLE_ID ?? "",
    privateKeyPath: process.env.APNS_PRIVATE_KEY_PATH ?? "",
  },

  dailyBriefCron: process.env.DAILY_BRIEF_CRON ?? "0 7 * * *",

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
    // The phone Jarvis calls. Single-user deployment, so this lives in
    // config rather than per-device app settings.
    callToNumber: process.env.CALL_TO_NUMBER ?? "",
  },
  get twilioConfigured() {
    return !!(this.twilio.accountSid && this.twilio.authToken && this.twilio.fromNumber && this.twilio.callToNumber);
  },

  alerts: {
    checkCron: process.env.ALERT_CHECK_CRON ?? "*/30 * * * *",
    // Call when any watchlist ticker moves at least this many percentage
    // points in a day (absolute value).
    marketMoveThresholdPercent: Number(process.env.CALL_MARKET_MOVE_THRESHOLD_PERCENT ?? 3),
    callOnUrgentEmail: (process.env.CALL_ON_URGENT_EMAIL ?? "true") === "true",
    // Don't call again for the same kind of alert within this many minutes.
    cooldownMinutes: Number(process.env.CALL_COOLDOWN_MINUTES ?? 120),
  },
};
