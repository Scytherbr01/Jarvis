import AppIntents

/// Lets you say "Hey Siri, read my Jarvis brief" without opening the app.
/// Fetches the brief from the backend and speaks it via BriefSpeechService.
/// Siri may still briefly show the app depending on iOS version/settings —
/// that's an OS-level decision for audio intents, not something an app can
/// fully override.
struct ReadDailyBriefIntent: AppIntent {
    static var title: LocalizedStringResource = "Read Daily Brief"
    static var description = IntentDescription("Reads your Jarvis daily brief aloud.")
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let watchlist = UserDefaults.standard.stringArray(forKey: "jarvisWatchlist")
        let gmailTokens: GmailTokens? = {
            guard let data = KeychainStore.get("gmailTokens")?.data(using: .utf8) else { return nil }
            return try? JSONDecoder().decode(GmailTokens.self, from: data)
        }()

        do {
            let brief = try await JarvisAPIClient.shared.fetchDailyBrief(gmailTokens: gmailTokens, watchlist: watchlist)
            BriefSpeechService.shared.speak(brief)
            return .result(dialog: "Here's your daily brief.")
        } catch {
            return .result(dialog: "I couldn't reach your Jarvis backend to build today's brief.")
        }
    }
}

struct JarvisShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ReadDailyBriefIntent(),
            phrases: [
                "Read my \(.applicationName) brief",
                "Play my \(.applicationName) daily brief",
                "What's my \(.applicationName) brief"
            ],
            shortTitle: "Read Daily Brief",
            systemImageName: "speaker.wave.2.fill"
        )
    }
}
