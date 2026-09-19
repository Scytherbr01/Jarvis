import SwiftUI
import AuthenticationServices

struct SettingsView: View {
    @AppStorage("jarvisBackendURL") private var backendURL: String = ""
    @State private var apiKey: String = KeychainStore.get("jarvisApiKey") ?? ""
    @State private var connections: [Connection] = []
    @State private var briefTime = Date()
    @State private var isGmailConnected = KeychainStore.get("gmailTokens") != nil
    @State private var webAuthSession: ASWebAuthenticationSession?
    @State private var statusMessage: String?
    @State private var twilioConfigured = false
    @State private var twilioEnabled = false
    @State private var isSendingTestCall = false

    var body: some View {
        Form {
            Section {
                TextField("https://your-backend.example.com", text: $backendURL)
                    .textContentType(.URL)
                    .autocapitalization(.none)
                    .foregroundStyle(JarvisTheme.textPrimary)
                SecureField("API key", text: $apiKey)
                    .foregroundStyle(JarvisTheme.textPrimary)
                    .onChange(of: apiKey) { _, newValue in
                        KeychainStore.set(newValue, forKey: "jarvisApiKey")
                    }
            } header: {
                Text("Jarvis Backend").foregroundStyle(JarvisTheme.accent)
            }
            .listRowBackground(JarvisTheme.surface)

            Section {
                DatePicker("Notify me at", selection: $briefTime, displayedComponents: .hourAndMinute)
                    .foregroundStyle(JarvisTheme.textPrimary)
                    .onChange(of: briefTime) { _, newValue in scheduleNotification(at: newValue) }
                if let statusMessage {
                    Text(statusMessage).font(.caption).foregroundStyle(JarvisTheme.textSecondary)
                }
            } header: {
                Text("Daily Brief Time").foregroundStyle(JarvisTheme.accent)
            }
            .listRowBackground(JarvisTheme.surface)

            Section {
                ForEach(connections) { connection in
                    ConnectionRow(
                        connection: connection,
                        isConnected: connection.id == "gmail" ? isGmailConnected : connection.available,
                        onConnect: connection.id == "gmail" ? connectGmail : nil
                    )
                }
            } header: {
                Text("Connections").foregroundStyle(JarvisTheme.accent)
            }
            .listRowBackground(JarvisTheme.surface)

            Section {
                Toggle(isOn: Binding(get: { twilioEnabled }, set: { toggleCallAlerts($0) })) {
                    Text("Call me for urgent updates").foregroundStyle(JarvisTheme.textPrimary)
                }
                .tint(JarvisTheme.accent)
                .disabled(!twilioConfigured)

                if twilioConfigured {
                    Button {
                        Task { await sendTestCall() }
                    } label: {
                        Text(isSendingTestCall ? "Calling…" : "Send a test call")
                    }
                    .disabled(isSendingTestCall)
                    .foregroundStyle(JarvisTheme.accent)
                }
            } header: {
                Text("Call Alerts").foregroundStyle(JarvisTheme.accent)
            } footer: {
                Text(
                    twilioConfigured
                        ? "Twilio is configured on the backend. Toggle on to let the alert-check cron call you for market moves and urgent email — see backend/README.md to tune thresholds."
                        : "Uses Twilio, a paid calling service — disabled until you add Twilio credentials to the backend's .env (see backend/README.md). Flip this on once they're set."
                )
                .foregroundStyle(JarvisTheme.textTertiary)
            }
            .listRowBackground(JarvisTheme.surface)
        }
        .scrollContentBackground(.hidden)
        .background(JarvisTheme.background.ignoresSafeArea())
        .navigationTitle("Settings")
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task {
            await loadConnections()
            await refreshTwilioStatus()
        }
    }

    private func loadConnections() async {
        guard !backendURL.isEmpty, !apiKey.isEmpty else { return }
        connections = (try? await JarvisAPIClient.shared.fetchConnections()) ?? []
    }

    private func refreshTwilioStatus() async {
        guard !backendURL.isEmpty, !apiKey.isEmpty else { return }
        if let status = try? await JarvisAPIClient.shared.twilioStatus() {
            twilioConfigured = status.configured
            twilioEnabled = status.enabled
        }
    }

    private func toggleCallAlerts(_ newValue: Bool) {
        Task {
            do {
                let status = try await JarvisAPIClient.shared.setTwilioEnabled(newValue)
                twilioConfigured = status.configured
                twilioEnabled = status.enabled
            } catch {
                statusMessage = "Couldn't update call alerts: \(error.localizedDescription)"
            }
        }
    }

    private func sendTestCall() async {
        isSendingTestCall = true
        defer { isSendingTestCall = false }
        do {
            try await JarvisAPIClient.shared.callAlert(message: "This is a test call from Jarvis. Call alerts are working.")
        } catch {
            statusMessage = "Test call failed: \(error.localizedDescription)"
        }
    }

    private func connectGmail() {
        Task {
            do {
                let authURL = try await JarvisAPIClient.shared.gmailAuthURL()
                let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: "jarvis") { callbackURL, _ in
                    guard let callbackURL,
                          let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                              .queryItems?.first(where: { $0.name == "code" })?.value
                    else { return }
                    Task {
                        if let tokens = try? await JarvisAPIClient.shared.exchangeGmailCode(code) {
                            let data = try? JSONEncoder().encode(tokens)
                            if let data, let json = String(data: data, encoding: .utf8) {
                                KeychainStore.set(json, forKey: "gmailTokens")
                                isGmailConnected = true
                            }
                        }
                    }
                }
                session.presentationContextProvider = GmailAuthContextProvider.shared
                webAuthSession = session
                session.start()
            } catch {
                statusMessage = "Couldn't start Gmail sign-in: \(error.localizedDescription)"
            }
        }
    }

    private func scheduleNotification(at date: Date) {
        Task {
            let granted = await BriefNotificationScheduler.requestAuthorization()
            guard granted else {
                statusMessage = "Enable notifications in iOS Settings to get a daily push."
                return
            }
            let components = Calendar.current.dateComponents([.hour, .minute], from: date)
            BriefNotificationScheduler.scheduleDaily(at: components)
            statusMessage = "Daily brief notification scheduled."
        }
    }
}

private struct ConnectionRow: View {
    let connection: Connection
    let isConnected: Bool
    let onConnect: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(connection.name).foregroundStyle(JarvisTheme.textPrimary)
                Spacer()
                if !connection.available {
                    Text("Unavailable").font(.caption).foregroundStyle(JarvisTheme.textSecondary)
                } else if isConnected {
                    Label("Connected", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(JarvisTheme.success)
                } else if let onConnect {
                    Button("Connect", action: onConnect)
                        .font(.caption)
                        .foregroundStyle(JarvisTheme.accent)
                }
            }
            if let reason = connection.reason {
                Text(reason).font(.caption2).foregroundStyle(JarvisTheme.textTertiary)
            }
        }
    }
}

/// ASWebAuthenticationSession needs a presentation anchor; this hands it
/// the app's key window.
final class GmailAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = GmailAuthContextProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

#Preview {
    NavigationStack { SettingsView() }
}
