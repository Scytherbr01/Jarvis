import Foundation

@MainActor
final class DailyBriefViewModel: ObservableObject {
    @Published var brief: DailyBrief?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var storedGmailTokens: GmailTokens? {
        guard let data = KeychainStore.get("gmailTokens")?.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(GmailTokens.self, from: data)
    }

    func refresh() async {
        isLoading = true
        errorMessage = nil
        do {
            let watchlist = UserDefaults.standard.stringArray(forKey: "jarvisWatchlist")
            brief = try await JarvisAPIClient.shared.fetchDailyBrief(
                gmailTokens: storedGmailTokens,
                watchlist: watchlist
            )
        } catch JarvisAPIError.notConfigured {
            errorMessage = "Connect your Jarvis backend in Settings to load a brief."
        } catch {
            errorMessage = "Couldn't load today's brief: \(error.localizedDescription)"
        }
        isLoading = false
    }
}
