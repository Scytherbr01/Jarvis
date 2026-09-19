# Jarvis Agent Backend

Node/TypeScript/Express service that implements the actual "daily brief
routine": it pulls important Gmail messages, a rules-based stock market
trend read, and top news headlines, and composes them into one JSON brief
the iOS app renders or gets notified about.

## Setup

```bash
npm install
cp .env.example .env
# fill in .env — see below
npm run dev       # http://localhost:8787
```

### Environment variables (`.env`)

| Variable | Required for | Notes |
|---|---|---|
| `JARVIS_API_KEYS` | everything | comma-separated list of keys the iOS app sends as `x-jarvis-key`; generate a long random string per device |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail + YouTube | create an OAuth client at [Google Cloud Console](https://console.cloud.google.com/apis/credentials), enable the Gmail API and YouTube Data API v3, add both `GOOGLE_REDIRECT_URI` and `GOOGLE_YOUTUBE_REDIRECT_URI` as authorized redirect URIs |
| `ALPHA_VANTAGE_API_KEY` | Stocks | free key at alphavantage.co; free tier is rate-limited (5 req/min), fine for one daily brief |
| `NEWS_API_KEY` | News | free key at newsapi.org |
| `ANTHROPIC_API_KEY` | "Ask Jarvis" voice commands | drafts emails/texts; get one at [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `DEFAULT_WATCHLIST` | Stocks | comma-separated tickers used when the app doesn't send its own |
| `DAILY_BRIEF_CRON` | scheduled generation | cron expression, default 7am daily |
| `APNS_*` | push notifications | only needed if you wire up server-push (see below); local notifications from the app work without this |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` / `CALL_TO_NUMBER` | Call alerts | all four required together; see **Call alerts** below |
| `ALERT_CHECK_CRON` / `CALL_MARKET_MOVE_THRESHOLD_PERCENT` / `CALL_ON_URGENT_EMAIL` / `CALL_COOLDOWN_MINUTES` | Call alerts | tune what counts as urgent and how often to check |
| `GMAIL_SERVER_REFRESH_TOKEN` | Call alerts (email) | optional — lets the alert cron check Gmail without the app open; see **Call alerts** below |

## Endpoints

All under `/api`, all require the `x-jarvis-key` header.

- `POST /api/daily-brief` — body `{ gmailTokens?, watchlist? }`, returns the full `DailyBrief` JSON.
- `GET /api/connections` — list of connections and which are actually available (see below).
- `GET /api/oauth/gmail/url` — Gmail OAuth consent URL for the app to open.
- `POST /api/oauth/gmail/exchange` — body `{ code }`, exchanges an OAuth code for tokens. The auth URL requests both `gmail.readonly` and `gmail.send` scopes.
- `POST /api/compose/email` — body `{ recipientName?, recipientEmail?, topic, instructions? }`, returns `{ subject, body }` drafted by Claude. Draft only, never sends.
- `POST /api/compose/text` — body `{ recipientName?, topic, instructions? }`, returns `{ body }` drafted by Claude, SMS-style. Draft only.
- `POST /api/gmail/send` — body `{ gmailTokens, to, subject, body }`, actually sends via Gmail. Only call this after the user has approved a draft.
- `POST /api/agent/dispatch` — body `{ transcript }`, returns `{ tool, input }`: the AI subagent dispatcher, using Claude tool-calling to pick which subagent (draft_email, draft_text, place_call, open_app, create_youtube_content) a spoken command means. Routing only — the app performs the actual action.
- `GET /api/oauth/youtube/url` — YouTube OAuth consent URL for the app to open (requests `youtube.upload` + `youtube.readonly`).
- `POST /api/oauth/youtube/exchange` — body `{ code }`, exchanges an OAuth code for tokens.
- `POST /api/content/draft` — body `{ topic }`, returns `{ title, description, tags, script }` drafted by Claude for a YouTube upload. Draft only, never posts. Doesn't generate footage — pair it with a video you already have.
- `POST /api/youtube/upload` — body `{ youtubeTokens, sourceUrl, title, description, tags? }`, fetches the video at `sourceUrl` and posts it to YouTube (private by default). Requires YouTube tokens from the OAuth flow above.
- `GET /api/twilio/status` — `{ configured: boolean }`, whether call-alerts are set up. Drives the on/off state of the Settings toggle in both apps.
- `POST /api/call-alert` — body `{ message }`, places a real phone call right now reading `message` aloud. Used by the apps' "Test call" button and internally by the alert-check cron. Returns 409 if Twilio isn't configured.

## Call alerts (Twilio)

Places an actual phone call — not a push notification — when something
crosses a threshold you set. **This costs real money**: Twilio charges
for the phone number (~$1/mo) and per-minute for calls (~$0.013/min in
the US). Nothing here runs until all of `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, and `CALL_TO_NUMBER` are set —
get an account and number at [twilio.com/console](https://www.twilio.com/console).

Two triggers, checked on `ALERT_CHECK_CRON` (default every 30 minutes):
- A watchlist ticker moves at least `CALL_MARKET_MOVE_THRESHOLD_PERCENT`
  (default 3%) in either direction.
- A new Gmail message arrives that Gmail itself flags important (needs
  `GMAIL_SERVER_REFRESH_TOKEN` — see below; skipped without it).

Each kind of alert calls at most once per `CALL_COOLDOWN_MINUTES` (default
120) — it won't call again for the same still-true condition until that
window passes. Cooldown state is in-memory and resets on server restart.

**Wiring up the unattended email check** (optional — market alerts work
without this):
1. Set `GMAIL_LOG_REFRESH_TOKEN=true` and restart the server.
2. Connect Gmail once from either app's Settings screen.
3. Copy the refresh token the server logs to `GMAIL_SERVER_REFRESH_TOKEN`.
4. Set `GMAIL_LOG_REFRESH_TOKEN=false` (or remove it) and restart.

## Run the daily brief routine without the app

```bash
npm run brief:run
```

Prints the same JSON the app receives. Useful for testing changes to the
market/news/email logic, or for wiring this into your own cron/launchd job
independent of the built-in scheduler in `src/index.ts`.

## Stock market "advice" — read this

`src/services/marketService.ts` computes a simple rules-based signal (price
vs. 50-day simple moving average) per ticker and a one-line summary. **This
is not investment advice** — it's a cheap, transparent heuristic meant to
flag names worth a closer look, not a recommendation to trade. Swap in a
real strategy or a licensed data/advice provider before relying on it for
anything real.

## Integrations that are NOT implemented, and why

Instagram, WickrGov, Signal, and Messages (iMessage/SMS) appear in
`src/services/connections.ts` marked `available: false` with a reason.
These are hard platform limits, not missing effort:

- **Signal** has no public API for reading messages or notifications —
  intentional, for user privacy.
- **WickrGov** is a closed government/enterprise platform; there's no
  public API for personal-app integration.
- **iMessage/Messages** — iOS does not let third-party apps read another
  app's notifications or message content.
- **Instagram**'s Graph API only covers business/creator account data, not
  personal DM notifications.

If any of these platforms ship a public API in the future, add a service
file alongside `gmailService.ts` and flip `available: true` in
`connections.ts` — the app's Settings screen and daily brief agent are
already structured to pick up a new source the same way Gmail is wired in.

## Deploying

Any Node host works (Fly.io, Render, a small VPS, etc.). Requirements:
- HTTPS in production (the iOS app / App Store review requires it via ATS).
- Set `JARVIS_API_KEYS` to a value only your device knows.
- Persist nothing sensitive server-side by default — Gmail tokens are sent
  by the client on each request and not stored here. If you add
  server-side token storage for push notifications, encrypt at rest.
