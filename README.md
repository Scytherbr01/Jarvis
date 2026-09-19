# Jarvis

An AI daily-brief agent: one function pulls your important Gmail, a
rules-based stock market trend read, and top news headlines into a single
brief, exposed through a backend service and an iOS app.

- **`backend/`** — the actual agent. Node/TypeScript/Express service with
  Gmail, market-data, and news integrations, a REST API, and a scheduler.
  See `backend/README.md`.
- **`ios/`** — SwiftUI app that calls the backend, shows the brief, and
  lets you connect accounts. See `ios/README.md`.

## Quick start

```bash
cd backend
npm install
cp .env.example .env   # add your API keys, see backend/README.md
npm run dev
```

Then either:
- `npm run brief:run` to print today's brief in the terminal, or
- open the iOS project per `ios/README.md`, point it at the backend URL
  and API key in Settings, and run it in the simulator or on your phone.

## What's real, what's a placeholder

Gmail, News, and Stock Market are fully implemented against real APIs.

Instagram, WickrGov, Signal, and Messages are shown in the app's
Connections screen but marked unavailable, because those platforms don't
expose a public API for reading personal messages/notifications — this is
a platform limitation, not something more engineering effort fixes. Details
and reasons are in `backend/src/services/connections.ts`. If that ever
changes, the codebase is structured so adding a new source follows the
same pattern as Gmail.

## Publishing to the App Store

I built and can keep maintaining the app, but I can't create your Apple
Developer account or click submit — that has to happen in your own App
Store Connect account. Full checklist in `ios/README.md`.
