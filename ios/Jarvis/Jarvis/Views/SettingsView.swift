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

    var body: some View {
        Form {
            Section("Jarvis Backend") {
                TextField("https://your-backend.example.com", text: $backendURL)
                    .textContentType(.URL)
                    .autocapitalization(.none)
                SecureField("API key", text: $apiKey)
                    .onChange(of: apiKey) { _, newValue in
                        KeychainStore.set(newValue, forKey: "jarvisApiKey")
                    }
            }

            Section("Daily Brief Time") {
                DatePicker("Notify me at", selection: $briefTime, displayedComponents: .hourAndMinute)
                    .onChange(of: briefTime) { _, newValue in scheduleNotification(at: newValue) }
                if let statusMessage {
                    Text(statusMessage).font(.caption).foregroundStyle(.secondary)
                }
            }

            Section("Connections") {
                ForEach(connections) { connection in
                    ConnectionRow(
                        connection: connection,
                        isConnected: connection.id == "gmail" ? isGmailConnected : connection.available,
                        onConnect: connection.id == "gmail" ? connectGmail : nil
                    )
                }
            }
        }
        .navigationTitle("Settings")
        .task { await loadConnections() }
    }

    private func loadConnections() async {
        guard !backendURL.isEmpty, !apiKey.isEmpty else { return }
        connections = (try? await JarvisAPIClient.shared.fetchConnections()) ?? []
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
                Text(connection.name)
                Spacer()
                if !connection.available {
                    Text("Unavailable").font(.caption).foregroundStyle(.secondary)
                } else if isConnected {
                    Label("Connected", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                } else if let onConnect {
                    Button("Connect", action: onConnect)
                        .font(.caption)
                }
            }
            if let reason = connection.reason {
                Text(reason).font(.caption2).foregroundStyle(.secondary)
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
