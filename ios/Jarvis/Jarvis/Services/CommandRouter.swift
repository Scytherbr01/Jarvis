import Foundation

/// What a voice command resolved to. Kept deliberately simple — a small
/// set of keyword-anchored patterns rather than a general NLU model. Good
/// enough for "email/text/call/open" style commands; anything else comes
/// back as `.unknown` and the UI asks the user to rephrase.
enum JarvisCommand {
    case composeEmail(recipient: String?, topic: String)
    case composeText(recipient: String?, topic: String)
    case call(target: String)
    case openApp(name: String)
    case unknown(transcript: String)
}

enum CommandRouter {
    private static let openAppSchemes: [String: String] = [
        "instagram": "instagram://",
        "messages": "sms:",
        "phone": "tel:",
        "signal": "sgnl://",
        "gmail": "googlegmail://",
        "maps": "maps://",
        "calendar": "calshow://",
        "settings": "app-settings:",
    ]

    static func route(_ rawTranscript: String) -> JarvisCommand {
        let transcript = rawTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = transcript.lowercased()

        if let match = extractAfter(["write an email", "email", "draft an email", "send an email"], in: transcript) {
            let (recipient, topic) = splitRecipientAndTopic(match)
            return .composeEmail(recipient: recipient, topic: topic)
        }

        if let match = extractAfter(["text", "message", "send a text", "draft a text"], in: transcript) {
            let (recipient, topic) = splitRecipientAndTopic(match)
            return .composeText(recipient: recipient, topic: topic)
        }

        if let match = extractAfter(["call"], in: transcript) {
            return .call(target: match)
        }

        if lower.hasPrefix("open ") {
            let name = String(transcript.dropFirst(5)).trimmingCharacters(in: .whitespaces)
            return .openApp(name: name)
        }

        return .unknown(transcript: transcript)
    }

    static func urlScheme(forAppNamed name: String) -> URL? {
        let key = name.lowercased().trimmingCharacters(in: .whitespaces)
        guard let scheme = openAppSchemes[key] else { return nil }
        return URL(string: scheme)
    }

    /// Finds the first keyword phrase and returns everything after it.
    /// e.g. "Jarvis write an email to Sam about rescheduling Friday"
    /// with keyword "write an email" -> "to Sam about rescheduling Friday"
    private static func extractAfter(_ keywords: [String], in transcript: String) -> String? {
        let lower = transcript.lowercased()
        for keyword in keywords.sorted(by: { $0.count > $1.count }) {
            if let range = lower.range(of: keyword) {
                let rest = String(transcript[range.upperBound...]).trimmingCharacters(in: .whitespaces)
                if !rest.isEmpty { return rest }
            }
        }
        return nil
    }

    /// "to Sam about rescheduling Friday" -> (recipient: "Sam", topic: "rescheduling Friday")
    private static func splitRecipientAndTopic(_ text: String) -> (recipient: String?, topic: String) {
        guard text.lowercased().hasPrefix("to ") else {
            return (nil, text)
        }
        let afterTo = String(text.dropFirst(3))
        if let aboutRange = afterTo.range(of: " about ", options: .caseInsensitive) {
            let recipient = String(afterTo[..<aboutRange.lowerBound]).trimmingCharacters(in: .whitespaces)
            let topic = String(afterTo[aboutRange.upperBound...]).trimmingCharacters(in: .whitespaces)
            return (recipient.isEmpty ? nil : recipient, topic)
        }
        // "to Sam" with no explicit topic — treat the rest as the topic too.
        return (nil, text)
    }
}
