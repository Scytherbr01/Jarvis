import SwiftUI

struct AskJarvisView: View {
    @StateObject private var viewModel = AskJarvisViewModel()
    @StateObject private var speech = BriefSpeechService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var showingMessageCompose = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                content
                Spacer()
                orbButton
            }
            .padding()
            .background(JarvisTheme.background.ignoresSafeArea())
            .navigationTitle("Ask Jarvis")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { viewModel.reset(); dismiss() }
                        .foregroundStyle(JarvisTheme.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            VStack(spacing: 8) {
                Text("Tap the orb and try:").foregroundStyle(JarvisTheme.textSecondary)
                Text("\"Email Sam about rescheduling Friday\"\n\"Text Sam I'm running late\"\n\"Call Sam\"\n\"Open Instagram\"")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(JarvisTheme.textTertiary)
            }
        case .listening:
            VStack(spacing: 8) {
                Text(viewModel.transcript.isEmpty ? "Listening…" : viewModel.transcript)
                    .foregroundStyle(JarvisTheme.textPrimary)
            }
        case .working:
            VStack(spacing: 12) {
                JarvisOrb(isActive: true, size: 60)
                Text("Working on it…").foregroundStyle(JarvisTheme.textSecondary)
            }
        case .emailDraft(let recipientName, let recipientEmail, let draft):
            EmailDraftCard(
                recipientName: recipientName,
                recipientEmail: recipientEmail,
                draft: draft,
                onReadAgain: { BriefSpeechService.shared.speak(text: "Subject: \(draft.subject). \(draft.body)") },
                onSend: { email in Task { await viewModel.sendDraftedEmail(recipientEmail: email, draft: draft) } },
                onDiscard: { viewModel.reset() }
            )
        case .emailSent:
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundStyle(JarvisTheme.success)
                Text("Email sent.").foregroundStyle(JarvisTheme.textPrimary)
            }
        case .textDraft(let recipientName, let phoneNumber, let body):
            TextDraftCard(
                recipientName: recipientName,
                phoneNumber: phoneNumber,
                messageBody: body,
                onReadAgain: { BriefSpeechService.shared.speak(text: body) },
                onOpenCompose: { showingMessageCompose = true },
                onDiscard: { viewModel.reset() }
            )
            .sheet(isPresented: $showingMessageCompose) {
                if MessageComposeView.canSendText {
                    MessageComposeView(recipient: phoneNumber, body: body) { _ in
                        showingMessageCompose = false
                        viewModel.reset()
                    }
                } else {
                    Text("This device can't send text messages.")
                }
            }
        case .callReady(let target, let number):
            VStack(spacing: 12) {
                Text("Call \(target)?").font(.headline).foregroundStyle(JarvisTheme.textPrimary)
                Text(number).foregroundStyle(JarvisTheme.textSecondary)
                Text("iOS will ask you to confirm before dialing — that step can't be skipped.")
                    .font(.caption)
                    .foregroundStyle(JarvisTheme.textTertiary)
                    .multilineTextAlignment(.center)
                HStack {
                    Button("Cancel") { viewModel.reset() }
                        .foregroundStyle(JarvisTheme.textSecondary)
                    Button("Call") { Task { await viewModel.confirmCall(number: number) } }
                        .buttonStyle(.borderedProminent)
                        .tint(JarvisTheme.accent)
                }
            }
        case .appOpened(let name):
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundStyle(JarvisTheme.success)
                Text("Opened \(name).").foregroundStyle(JarvisTheme.textPrimary)
            }
        case .error(let message):
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 32)).foregroundStyle(JarvisTheme.warning)
                Text(message).multilineTextAlignment(.center).font(.subheadline).foregroundStyle(JarvisTheme.textPrimary)
                Button("Try again") { viewModel.reset() }
                    .foregroundStyle(JarvisTheme.accent)
            }
        }
    }

    /// The orb doubles as the mic button. It pulses while listening (red-
    /// tinted rings) and while Jarvis is speaking a draft back (its normal
    /// cyan), so the same glow is the app's "I'm active" indicator
    /// throughout the flow, not just an icon that swaps.
    private var orbButton: some View {
        Button {
            if case .listening = viewModel.state {
                viewModel.stopListeningAndRoute()
            } else if case .idle = viewModel.state {
                viewModel.startListening()
            } else {
                viewModel.reset()
            }
        } label: {
            JarvisOrb(isActive: isListening || speech.isSpeaking, size: 96)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isListening ? "Stop listening" : "Ask Jarvis")
    }

    private var isListening: Bool {
        if case .listening = viewModel.state { return true }
        return false
    }
}

private struct EmailDraftCard: View {
    let recipientName: String?
    let recipientEmail: String?
    let draft: EmailDraft
    let onReadAgain: () -> Void
    let onSend: (String) -> Void
    let onDiscard: () -> Void

    @State private var manualEmail: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let recipientName {
                Text("To: \(recipientName)").font(.caption).foregroundStyle(JarvisTheme.textSecondary)
            }
            Text(draft.subject).font(.headline).foregroundStyle(JarvisTheme.textPrimary)
            ScrollView {
                Text(draft.body).font(.body).foregroundStyle(JarvisTheme.textPrimary)
            }
            .frame(maxHeight: 200)

            if recipientEmail == nil {
                TextField("Recipient email address", text: $manualEmail)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textFieldStyle(.roundedBorder)
            }

            HStack {
                Button("Read again", action: onReadAgain)
                    .foregroundStyle(JarvisTheme.accent)
                Spacer()
                Button("Discard", role: .destructive, action: onDiscard)
                Button("Send") { onSend(recipientEmail ?? manualEmail) }
                    .buttonStyle(.borderedProminent)
                    .tint(JarvisTheme.accent)
                    .disabled((recipientEmail ?? manualEmail).isEmpty)
            }
        }
        .jarvisCard()
    }
}

private struct TextDraftCard: View {
    let recipientName: String
    let phoneNumber: String
    let messageBody: String
    let onReadAgain: () -> Void
    let onOpenCompose: () -> Void
    let onDiscard: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("To: \(recipientName) (\(phoneNumber))").font(.caption).foregroundStyle(JarvisTheme.textSecondary)
            Text(messageBody).font(.body).foregroundStyle(JarvisTheme.textPrimary)
            Text("You'll tap Send yourself in the next screen — iOS doesn't allow apps to send texts automatically.")
                .font(.caption)
                .foregroundStyle(JarvisTheme.textTertiary)
            HStack {
                Button("Read again", action: onReadAgain)
                    .foregroundStyle(JarvisTheme.accent)
                Spacer()
                Button("Discard", role: .destructive, action: onDiscard)
                Button("Open Messages", action: onOpenCompose)
                    .buttonStyle(.borderedProminent)
                    .tint(JarvisTheme.accent)
            }
        }
        .jarvisCard()
    }
}

#Preview {
    AskJarvisView()
}
