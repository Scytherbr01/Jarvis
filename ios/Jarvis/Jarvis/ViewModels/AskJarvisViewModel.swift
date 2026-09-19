import Foundation

enum AskJarvisState {
    case idle
    case listening
    case working
    case emailDraft(recipientName: String?, recipientEmail: String?, draft: EmailDraft)
    case emailSent
    case textDraft(recipientName: String, phoneNumber: String, body: String)
    case callReady(target: String, number: String)
    case appOpened(name: String)
    case error(String)
}

@MainActor
final class AskJarvisViewModel: ObservableObject {
    @Published var state: AskJarvisState = .idle
    @Published var transcript: String = ""

    private let voice = VoiceCommandService.shared
    private let speech = BriefSpeechService.shared

    private var storedGmailTokens: GmailTokens? {
        guard let data = KeychainStore.get("gmailTokens")?.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(GmailTokens.self, from: data)
    }

    func startListening() {
        Task {
            guard await voice.requestAuthorization() else {
                state = .error("Enable Microphone and Speech Recognition access in iOS Settings to use Ask Jarvis.")
                return
            }
            do {
                try voice.startListening()
                state = .listening
            } catch {
                state = .error("Couldn't start listening: \(error.localizedDescription)")
            }
        }
    }

    func stopListeningAndRoute() {
        let finalTranscript = voice.stopListening()
        transcript = finalTranscript
        guard !finalTranscript.isEmpty else {
            state = .idle
            return
        }
        Task { await route(finalTranscript) }
    }

    private func route(_ text: String) async {
        state = .working
        switch CommandRouter.route(text) {
        case .composeEmail(let recipient, let topic):
            await handleComposeEmail(recipient: recipient, topic: topic)
        case .composeText(let recipient, let topic):
            await handleComposeText(recipient: recipient, topic: topic)
        case .call(let target):
            await handleCall(target: target)
        case .openApp(let name):
            await handleOpenApp(name: name)
        case .unknown(let raw):
            state = .error("I didn't catch a command in \"\(raw)\". Try \"email Sam about rescheduling Friday\", \"text Sam I'm running late\", \"call Sam\", or \"open Instagram\".")
        }
    }

    private func handleComposeEmail(recipient: String?, topic: String) async {
        var recipientEmail: String?
        if let recipient {
            recipientEmail = try? await ContactsLookup.emailAddress(forName: recipient)
        }
        do {
            let draft = try await JarvisAPIClient.shared.composeEmail(
                recipientName: recipient,
                recipientEmail: recipientEmail,
                topic: topic
            )
            state = .emailDraft(recipientName: recipient, recipientEmail: recipientEmail, draft: draft)
            speech.speak(text: "I've drafted an email\(recipient.map { " to \($0)" } ?? ""). Subject: \(draft.subject). \(draft.body)")
        } catch {
            state = .error("Couldn't draft that email: \(error.localizedDescription)")
        }
    }

    func sendDraftedEmail(recipientEmail: String, draft: EmailDraft) async {
        guard let tokens = storedGmailTokens else {
            state = .error("Connect Gmail in Settings first — I need send permission to actually send this.")
            return
        }
        state = .working
        do {
            try await JarvisAPIClient.shared.sendEmail(gmailTokens: tokens, to: recipientEmail, subject: draft.subject, body: draft.body)
            state = .emailSent
        } catch {
            state = .error("Couldn't send that email: \(error.localizedDescription)")
        }
    }

    private func handleComposeText(recipient: String?, topic: String) async {
        guard let recipient else {
            state = .error("Who should I text? Try \"text Sam I'm running late\".")
            return
        }
        do {
            let phoneNumber = try await ContactsLookup.phoneNumber(forName: recipient)
            let body = try await JarvisAPIClient.shared.composeText(recipientName: recipient, topic: topic)
            state = .textDraft(recipientName: recipient, phoneNumber: phoneNumber, body: body)
            speech.speak(text: "I've drafted a text to \(recipient): \(body). You'll need to tap Send yourself — iOS doesn't allow apps to send texts automatically.")
        } catch {
            state = .error("Couldn't draft that text: \(error.localizedDescription)")
        }
    }

    private func handleCall(target: String) async {
        do {
            let number = try await ContactsLookup.resolve(target)
            state = .callReady(target: target, number: number)
        } catch {
            state = .error("Couldn't find a number for \"\(target)\": \(error.localizedDescription)")
        }
    }

    func confirmCall(number: String) async {
        do {
            try await AppLauncher.dial(number)
            state = .idle
        } catch {
            state = .error("Couldn't open the dialer: \(error.localizedDescription)")
        }
    }

    private func handleOpenApp(name: String) async {
        do {
            try await AppLauncher.open(appNamed: name)
            state = .appOpened(name: name)
        } catch {
            state = .error("I don't have a way to open \"\(name)\" — it may not be installed, or doesn't support being opened by another app.")
        }
    }

    func reset() {
        speech.stop()
        state = .idle
        transcript = ""
    }
}
