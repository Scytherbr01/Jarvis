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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail | create an OAuth client at [Google Cloud Console](https://console.cloud.google.com/apis/credentials), enable the Gmail API, add `GOOGLE_REDIRECT_URI` as an authorized redirect URI |
| `ALPHA_VANTAGE_API_KEY` | Stocks | free key at alphavantage.co; free tier is rate-limited (5 req/min), fine for one daily brief |
| `NEWS_API_KEY` | News | free key at newsapi.org |
| `DEFAULT_WATCHLIST` | Stocks | comma-separated tickers used when the app doesn't send its own |
| `DAILY_BRIEF_CRON` | scheduled generation | cron expression, default 7am daily |
| `APNS_*` | push notifications | only needed if you wire up server-push (see below); local notifications from the app work without this |

## Endpoints

All under `/api`, all require the `x-jarvis-key` header.

- `POST /api/daily-brief` — body `{ gmailTokens?, watchlist? }`, returns the full `DailyBrief` JSON.
- `GET /api/connections` — list of connections and which are actually available (see below).
- `GET /api/oauth/gmail/url` — Gmail OAuth consent URL for the app to open.
- `POST /api/oauth/gmail/exchange` — body `{ code }`, exchanges an OAuth code for tokens.

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
