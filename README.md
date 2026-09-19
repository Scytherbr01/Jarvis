# Jarvis

An AI daily-brief agent: one function pulls your important Gmail, a
rules-based stock market trend read, and top news headlines into a single
brief, plus a voice assistant ("Ask Jarvis") that drafts emails/texts and
launches calls/apps — exposed through a backend service and two client
apps.

- **`backend/`** — the actual agent. Node/TypeScript/Express service with
  Gmail, market-data, news, and Claude-drafting integrations, a REST API,
  and a scheduler. See `backend/README.md`.
- **`mobile/`** — **the recommended app** — an Android app (Capacitor)
  buildable entirely from the command line or via GitHub Actions, no Mac
  needed. See `mobile/README.md`.
- **`ios/`** — the original SwiftUI app. Fully built and functional, but
  needs a Mac with Xcode to actually compile and run — kept in the repo
  for whenever that's available. See `ios/README.md`.

## Quick start

```bash
cd backend
npm install
cp .env.example .env   # add your API keys, see backend/README.md
npm run dev
```

Then either:
- `npm run brief:run` to print today's brief in the terminal, or
- get the Android app running per `mobile/README.md` (the GitHub Actions
  path there needs no local Android SDK at all), point it at the backend
  URL and API key in Settings, or
- if you have Mac access, open the iOS project per `ios/README.md`.

## What's real, what's a placeholder

Gmail, News, Stock Market, and the Claude-drafted email/text/call/app
voice commands are fully implemented against real APIs.

Instagram, WickrGov, Signal, and Messages are shown in the Connections
screen but marked unavailable, because those platforms don't expose a
public API for reading personal messages/notifications — this is a
platform limitation, not something more engineering effort fixes. Details
and reasons are in `backend/src/services/connections.ts`.

Twilio call-alerts has a visible-but-disabled toggle in Settings on both
apps, ready to switch on once the backend has Twilio credentials — that
backend piece is still in progress.

## Publishing

**Android**: sideloading the APK (see `mobile/README.md`) works today with
no account of any kind. Publishing to the Google Play Store instead needs
a one-time $25 Google Play Console registration, which you'd do yourself.

**iOS**: needs your own Apple Developer account ($99/yr) and a Mac to
build — full checklist in `ios/README.md`.
