import AVFoundation

/// Reads a DailyBrief aloud. This only speaks content Jarvis itself
/// generated (email subjects/senders, market advice, headlines) — it has
/// no access to notification content from other apps, same as everywhere
/// else in this project.
final class BriefSpeechService: NSObject, ObservableObject {
    static let shared = BriefSpeechService()

    @Published private(set) var isSpeaking = false

    private let synthesizer = AVSpeechSynthesizer()

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ brief: DailyBrief) {
        speak(text: Self.spokenText(for: brief))
    }

    func speak(text: String) {
        stop()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)

        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: Locale.current.identifier)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        synthesizer.speak(utterance)
        isSpeaking = true
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
    }

    static func spokenText(for brief: DailyBrief) -> String {
        var parts: [String] = [brief.greeting + ". Here is your daily brief."]

        parts.append(brief.market.advice)
        let notableTickers = brief.market.tickers.filter { $0.trend != .neutral }
        for ticker in notableTickers.prefix(3) {
            parts.append(ticker.note)
        }

        if brief.emails.isEmpty {
            parts.append("No important emails in the last day.")
        } else {
            parts.append("You have \(brief.emails.count) important email\(brief.emails.count == 1 ? "" : "s").")
            for email in brief.emails.prefix(3) {
                parts.append("From \(email.from): \(email.subject).")
            }
        }

        if !brief.headlines.isEmpty {
            parts.append("Top headlines:")
            for headline in brief.headlines.prefix(3) {
                parts.append(headline.title)
            }
        }

        return parts.joined(separator: " ")
    }
}

extension BriefSpeechService: AVSpeechSynthesizerDelegate {
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        isSpeaking = false
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        isSpeaking = false
    }
}
