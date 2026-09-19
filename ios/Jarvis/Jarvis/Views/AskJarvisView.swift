import SwiftUI

struct AskJarvisView: View {
    @StateObject private var viewModel = AskJarvisViewModel()
    @Environment(\.dismiss) private var dismiss
    @State private var showingMessageCompose = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                content
                Spacer()
                micButton
            }
            .padding()
            .navigationTitle("Ask Jarvis")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { viewModel.reset(); dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            VStack(spacing: 8) {
                Image(systemName: "waveform").font(.system(size: 40)).foregroundStyle(.secondary)
                Text("Tap the mic and try:").foregroundStyle(.secondary)
                Text("\"Email Sam about rescheduling Friday\"\n\"Text Sam I'm running late\"\n\"Call Sam\"\n\"Open Instagram\"")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.tertiary)
            }
        case .listening:
            VStack(spacing: 8) {
                Image(systemName: "waveform").font(.system(size: 40)).foregroundStyle(.red)
                Text(viewModel.transcript.isEmpty ? "Listening…" : viewModel.transcript)
            }
        case .working:
            ProgressView("Working on it…")
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
                Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundStyle(.green)
                Text("Email sent.")
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
                Text("Call \(target)?").font(.headline)
                Text(number).foregroundStyle(.secondary)
                Text("iOS will ask you to confirm before dialing — that step can't be skipped.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                HStack {
                    Button("Cancel") { viewModel.reset() }
                    Button("Call") { Task { await viewModel.confirmCall(number: number) } }
                        .buttonStyle(.borderedProminent)
                }
            }
        case .appOpened(let name):
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundStyle(.green)
                Text("Opened \(name).")
            }
        case .error(let message):
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 32)).foregroundStyle(.orange)
                Text(message).multilineTextAlignment(.center).font(.subheadline)
                Button("Try again") { viewModel.reset() }
            }
        }
    }

    private var micButton: some View {
        Button {
            if case .listening = viewModel.state {
                viewModel.stopListeningAndRoute()
            } else if case .idle = viewModel.state {
                viewModel.startListening()
            } else {
                viewModel.reset()
            }
        } label: {
            Image(systemName: micIcon)
                .font(.system(size: 32))
                .frame(width: 72, height: 72)
                .background(Circle().fill(isListening ? Color.red : Color.accentColor))
                .foregroundStyle(.white)
        }
    }

    private var isListening: Bool {
        if case .listening = viewModel.state { return true }
        return false
    }

    private var micIcon: String {
        if case .listening = viewModel.state { return "stop.fill" }
        return "mic.fill"
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
                Text("To: \(recipientName)").font(.caption).foregroundStyle(.secondary)
            }
            Text(draft.subject).font(.headline)
            ScrollView {
                Text(draft.body).font(.body)
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
                Spacer()
                Button("Discard", role: .destructive, action: onDiscard)
                Button("Send") { onSend(recipientEmail ?? manualEmail) }
                    .buttonStyle(.borderedProminent)
                    .disabled((recipientEmail ?? manualEmail).isEmpty)
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
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
            Text("To: \(recipientName) (\(phoneNumber))").font(.caption).foregroundStyle(.secondary)
            Text(messageBody).font(.body)
            Text("You'll tap Send yourself in the next screen — iOS doesn't allow apps to send texts automatically.")
                .font(.caption)
                .foregroundStyle(.tertiary)
            HStack {
                Button("Read again", action: onReadAgain)
                Spacer()
                Button("Discard", role: .destructive, action: onDiscard)
                Button("Open Messages", action: onOpenCompose)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }
}

#Preview {
    AskJarvisView()
}
