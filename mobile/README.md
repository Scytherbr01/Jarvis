# Jarvis Android App

The same Jarvis app as `../ios`, rebuilt as a real installable Android app
using [Capacitor](https://capacitorjs.com) — an HTML/CSS/JS front end
wrapped in a native Android project. No Mac, no Xcode, no App Store
account needed. It talks to the same `../backend` over the same REST API
as the iOS build.

## The fastest path: let GitHub build it for you

Building an Android app requires downloading Google's Android SDK and
Maven repository (`dl.google.com`) — that's blocked in the sandboxed
environment this was built in, so I couldn't produce a finished `.apk`
directly. But it's **not blocked on GitHub's own servers**, so a GitHub
Actions workflow is already set up at
`.github/workflows/build-android.yml`:

1. Push this repo to GitHub (if it isn't already).
2. Go to the **Actions** tab → "Build Android APK" → **Run workflow**
   (or just push a commit that touches anything under `mobile/`).
3. Wait for it to finish (a few minutes), then open the run and download
   the `jarvis-debug-apk` artifact — that's your `.apk` file.
4. Transfer it to your phone (email it to yourself, Google Drive, USB,
   whatever's easiest), tap it, and allow "install unknown apps" for
   whatever app you opened it from when prompted. It installs and runs
   like any other app.

No computer of any kind required for this path beyond what you're already
using to read this.

## Building it yourself locally (Linux or Windows, not just Mac)

If you'd rather build locally — on a regular Linux or Windows machine
(unlike iOS, this genuinely doesn't need a Mac):

1. Install [Node.js](https://nodejs.org) 20+.
2. Install the [Android command-line tools](https://developer.android.com/studio#command-tools)
   (you do **not** need the full Android Studio GUI — the command-line
   tools package alone is enough). Then:
   ```bash
   sdkmanager --licenses
   sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
   ```
3. Set `ANDROID_HOME` to wherever you installed it, e.g.:
   ```bash
   export ANDROID_HOME=$HOME/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```
4. From `mobile/`:
   ```bash
   npm install
   npm run build:apk
   ```
   This runs `cap sync android` and `gradlew assembleDebug`. The APK
   lands at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
5. Copy that file to your phone and install it the same way as above.

## Point it at your backend

Run `../backend` somewhere reachable (see `backend/README.md`), then open
the app, tap the gear icon, and enter:
- **Server**: your backend's URL
- **API key**: one of the values in the backend's `JARVIS_API_KEYS`

Tap **Connect** next to Gmail to run OAuth. News and Stock Market work as
soon as the backend has its own API keys configured.

## Ask Jarvis on Android

Same four voice commands as iOS (email, text, call, open app), with two
differences from the Swift build, both deliberate simplifications to keep
the first Android build dependency-light:

- **Speech-to-text**: tries the in-browser Web Speech API first. Android's
  WebView doesn't reliably support it on every device, so there's always a
  text field fallback — tap its keyboard's own mic button to dictate using
  the phone's system dictation instead. Either way, you can always just type.
- **Contacts**: there's no contacts-lookup plugin wired in yet (kept out to
  minimize first-build risk), so "text Sam" or "call Sam" asks you to type
  the phone number once, rather than resolving it automatically like the
  iOS build does. Adding `@capacitor-community/contacts` later would close
  that gap.

Email drafting → reading aloud → Gmail send is fully wired and identical
to iOS. Texting opens the Messages app pre-filled (you still tap Send —
no app can do that step for you, on either platform). Calling opens the
dialer (Android still asks you to confirm before it actually dials).

## Notifications

Daily-brief reminders use `@capacitor/local-notifications` — set a time in
Settings and it schedules a repeating local notification, no server push
infrastructure needed.

## What's shared with the iOS build

Everything server-side — `../backend` doesn't know or care which client is
calling it. The Swift/iOS app in `../ios` still exists and still works;
this isn't a replacement, just a second client for whenever you don't have
Mac access. If you get Mac access later, the iOS app is still there,
unchanged.

## Twilio call-alerts

The Settings screen has a "Call me for urgent updates" toggle. It's
disabled and explains why until the backend has real Twilio credentials
(see `backend/README.md`); once it does, the toggle actually enables/
disables the backend's alert-check cron (not just a local UI state — see
`POST /api/twilio/toggle`), and a "Test call" button places one
immediately so you can confirm it works before relying on it.

## Offline behavior

The most recent successful brief is cached on-device. If the backend is
unreachable next time you open the app, you still see that cached brief
with a banner noting how old it is and a **Retry** button, instead of a
bare error screen. The refresh icon (top-left of the Daily Brief screen)
re-fetches on demand at any time.

## Motion design

The reactor's rotation, pulse, and glow are driven by a small physics
loop in `js/reactor.js` rather than CSS keyframes — easing angular
velocity toward a target every frame so speeding up/slowing down (e.g.
when TTS starts or stops) reads as acceleration, not a snap-cut. Screen
and Ask-Jarvis state transitions cross-fade instead of cutting instantly.
Where `@capacitor/haptics` is available, primary actions (opening Ask
Jarvis, sending an email, confirming a call) get a light/medium haptic
tap.

## Recommended next upgrades

Not built yet, in roughly the order I'd prioritize them:

1. **Push notifications instead of local-only.** Local notifications only
   fire while the app has scheduled them on-device; a real push (Firebase
   Cloud Messaging) would let the backend notify you the moment something
   happens, not just at a fixed daily time, and would let a missed call
   alert also leave a notification with what it was about.
2. **Contacts integration** (`@capacitor-community/contacts`) — closes the
   gap noted above so "text Sam" / "call Sam" resolve automatically
   instead of asking for a number each time.
3. **Conversation memory in Ask Jarvis** — follow-ups like "also cc Sarah"
   after a draft, instead of every command starting from zero context.
4. **"What changed" diffing on the brief** — highlight what's new since
   the last time you looked, rather than restating everything.
5. **A real market-analysis upgrade** — the current signal (price vs.
   50-day average) is intentionally simple; a licensed data/signal
   provider would be a meaningfully more useful upgrade than more
   engineering on the current heuristic.
