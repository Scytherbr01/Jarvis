# Jarvis iOS App

SwiftUI client for the daily brief agent in `../backend`. This folder ships
source files, not a pre-built `.xcodeproj` — hand-crafted Xcode project
files are fragile and easy to corrupt outside Xcode itself, so the reliable
path is to let Xcode generate the project and drop these files in.

## Set up the Xcode project

1. Xcode → File → New → Project → **App**.
   - Product Name: `Jarvis`
   - Interface: SwiftUI, Language: Swift
   - Bundle Identifier: e.g. `com.yourname.jarvis` (must match `APNS_BUNDLE_ID`
     in the backend `.env` if you wire up push later)
2. Delete the generated `ContentView.swift` and default `Info.plist` entries
   that conflict with the ones here.
3. Drag `Jarvis/Models`, `Jarvis/Resources`, `Jarvis/Services`,
   `Jarvis/ViewModels`, `Jarvis/Views`, `Jarvis/Intents`, and
   `Jarvis/JarvisApp.swift` from this folder into the Xcode project
   navigator ("Copy items if needed" checked).
4. Merge `Jarvis/Info.plist` into your project's Info.plist (or replace it) —
   it declares the `jarvis://` URL scheme used for the Gmail OAuth redirect,
   the notifications usage string, and `UIUserInterfaceStyle: Dark` (the app
   never shows a light appearance, by design — see Visual design below).
   Replace Xcode's generated `Assets.xcassets` with `Jarvis/Assets.xcassets`
   from this folder — it carries the dark launch-screen background and
   accent color. It has no app icon image yet (just an empty 1024×1024
   slot); drop your own `AppIcon.png` into `Assets.xcassets/AppIcon.appiconset`
   before submitting, or the build will warn about a missing icon.
5. In Signing & Capabilities, add **Push Notifications** and **Background
   Modes → Remote notifications** if you wire up the APNs push described in
   the backend README. Local notifications (used for the daily brief
   reminder today) need no extra capability. **Siri** capability is needed
   for the "Hey Siri, read my Jarvis brief" shortcut.
6. Build target: iOS 17+ (uses `NavigationStack`, `ContentUnavailableView`,
   `AVAudioApplication.requestRecordPermission`).

## Point it at your backend

Run the backend (see `../backend/README.md`), then in the app's Settings
screen enter:
- **Backend URL**: e.g. `https://your-backend.example.com` (or your Mac's
  LAN IP + port while testing locally, e.g. `http://192.168.1.20:8787`)
- **API key**: one of the values in the backend's `JARVIS_API_KEYS`

Tap **Connect** next to Gmail to run the OAuth flow. News and Stock Market
work immediately once the backend has its API keys configured — there's
nothing to "connect" client-side for those.

## Visual design

The app is dark-only — `UIUserInterfaceStyle: Dark` in Info.plist plus
`.preferredColorScheme(.dark)` at the SwiftUI root, so it never renders a
light appearance regardless of the device's system setting. Colors live in
`Resources/JarvisTheme.swift` (near-black background, glowing cyan-blue
accent). `Views/JarvisOrb.swift` is the animated orb — it breathes slowly
at rest and pulses with expanding rings whenever `BriefSpeechService` is
speaking or `VoiceCommandService` is listening; it appears next to the
greeting on the Daily Brief screen and as the mic button on the Ask Jarvis
screen.

## Reading the brief aloud

Tap the play button (top-left of the Daily Brief screen) to have
`BriefSpeechService` read the market advice, important emails, and top
headlines out loud via `AVSpeechSynthesizer`. This only reads content
Jarvis itself generated — it has no access to notifications from other
apps (see below).

You can also say **"Hey Siri, read my Jarvis brief"** once you've opened
the app at least once (registers the shortcut from `Intents/ReadDailyBriefIntent.swift`).
Depending on iOS version and Siri settings, this may briefly show the app
before speaking — that's an OS-level behavior for audio intents, not
something the app controls.

## Ask Jarvis (voice commands)

Tap the "Ask Jarvis" button at the bottom of the Daily Brief screen, then
speak a command. `VoiceCommandService` transcribes it on-device (Speech
framework), `CommandRouter` matches it to one of four patterns, and the
result is handled per-command:

- **"Email Sam about rescheduling Friday"** — looks up Sam's email in
  Contacts, calls the backend's `/api/compose/email` (Claude drafts
  subject + body), reads the draft back via TTS, and shows Send/Discard.
  Tapping Send calls `/api/gmail/send` — this is genuinely hands-free,
  Gmail's send API needs no extra tap.
- **"Text Sam I'm running late"** — same drafting flow via
  `/api/compose/text`, but the result opens `MFMessageComposeViewController`
  pre-filled. **You have to tap Send yourself in that sheet** — there is no
  API for a third-party app to send SMS/iMessage without that tap; this is
  an iOS platform restriction, not a limitation of this app's code.
- **"Call Sam"** — resolves the number via Contacts and opens the system
  dialer. **iOS shows its own "Call Sam?" confirmation before it actually
  dials** — also a platform restriction (anti-fraud/anti-spam), which no
  app can suppress. It isn't fully hands-free, but it's one tap instead of
  finding the contact and dialing yourself.
- **"Open Instagram"** — opens the app via its URL scheme if installed.
  Only apps with a registered scheme, and listed in this app's
  `LSApplicationQueriesSchemes` (see `Info.plist`), can be opened this way.

Requires `ANTHROPIC_API_KEY` set on the backend (see `backend/README.md`),
and Gmail connected with the `gmail.send` scope — if you connected Gmail
before this feature was added, disconnect and reconnect in Settings to
pick up the new scope.

## What's real vs. placeholder

- **Gmail, News, Stock Market** — fully wired: the app calls the backend,
  the backend calls the real Gmail/Alpha Vantage/NewsAPI APIs.
- **Instagram, WickrGov, Signal, Messages** — shown in Settings but marked
  "Unavailable" with the reason why (see `backend/src/services/connections.ts`).
  These platforms don't expose a public API for reading personal messages
  or notifications, so there's no code path to wire up here yet.

## App Store submission

This app can be submitted once you:
1. Have an active Apple Developer Program membership ($99/yr).
2. Set a real bundle identifier and register it in App Store Connect.
3. Deploy the backend somewhere reachable over HTTPS (App Store review will
   test the app, and Apple requires HTTPS for network calls via ATS — a
   plain `http://` backend will fail review except on your own LAN during
   development).
4. Add a privacy policy URL (required because the app handles Gmail data)
   and fill out App Store Connect's Privacy/Data Collection questionnaire
   accurately — you're reading Gmail metadata (sender, subject, snippet),
   so declare that.
5. Archive (Product → Archive) and upload via Xcode Organizer, then submit
   the build for review in App Store Connect.

I can't create your Apple Developer account or click submit for you — that
part has to happen in your own App Store Connect account.
