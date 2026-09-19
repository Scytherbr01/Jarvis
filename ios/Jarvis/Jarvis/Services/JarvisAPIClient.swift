import Foundation

enum JarvisAPIError: Error {
    case notConfigured
    case server(String)
    case transport(Error)
}

/// Talks to the Jarvis agent backend (see /backend in this repo). The base
/// URL and API key are set once in SettingsView and stored in the Keychain
/// / UserDefaults; every request re-reads them so a change takes effect
/// immediately.
final class JarvisAPIClient {
    static let shared = JarvisAPIClient()

    private var baseURL: URL? {
        guard let raw = UserDefaults.standard.string(forKey: "jarvisBackendURL"), let url = URL(string: raw) else {
            return nil
        }
        return url
    }

    private var apiKey: String? {
        KeychainStore.get("jarvisApiKey")
    }

    private lazy var decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private lazy var encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private func request(path: String, method: String = "GET", body: Data? = nil) throws -> URLRequest {
        guard let baseURL, let apiKey, !apiKey.isEmpty else {
            throw JarvisAPIError.notConfigured
        }
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue(apiKey, forHTTPHeaderField: "x-jarvis-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        return request
    }

    func fetchDailyBrief(gmailTokens: GmailTokens?, watchlist: [String]?) async throws -> DailyBrief {
        struct Body: Encodable {
            let gmailTokens: GmailTokens?
            let watchlist: [String]?
        }
        let body = try encoder.encode(Body(gmailTokens: gmailTokens, watchlist: watchlist))
        let request = try request(path: "/api/daily-brief", method: "POST", body: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        return try decoder.decode(DailyBrief.self, from: data)
    }

    func fetchConnections() async throws -> [Connection] {
        let request = try request(path: "/api/connections")
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        return try decoder.decode([Connection].self, from: data)
    }

    func gmailAuthURL() async throws -> URL {
        struct Payload: Decodable { let url: String }
        let request = try request(path: "/api/oauth/gmail/url")
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        let payload = try decoder.decode(Payload.self, from: data)
        guard let url = URL(string: payload.url) else { throw JarvisAPIError.server("Invalid auth URL returned") }
        return url
    }

    func exchangeGmailCode(_ code: String) async throws -> GmailTokens {
        struct Body: Encodable { let code: String }
        let body = try encoder.encode(Body(code: code))
        let request = try request(path: "/api/oauth/gmail/exchange", method: "POST", body: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        return try decoder.decode(GmailTokens.self, from: data)
    }

    func composeEmail(recipientName: String?, recipientEmail: String?, topic: String, instructions: String? = nil) async throws -> EmailDraft {
        struct Body: Encodable {
            let recipientName: String?
            let recipientEmail: String?
            let topic: String
            let instructions: String?
        }
        let body = try encoder.encode(Body(recipientName: recipientName, recipientEmail: recipientEmail, topic: topic, instructions: instructions))
        let request = try request(path: "/api/compose/email", method: "POST", body: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        return try decoder.decode(EmailDraft.self, from: data)
    }

    func composeText(recipientName: String?, topic: String, instructions: String? = nil) async throws -> String {
        struct Body: Encodable {
            let recipientName: String?
            let topic: String
            let instructions: String?
        }
        struct Response: Decodable { let body: String }
        let body = try encoder.encode(Body(recipientName: recipientName, topic: topic, instructions: instructions))
        let request = try request(path: "/api/compose/text", method: "POST", body: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        return try decoder.decode(Response.self, from: data).body
    }

    func sendEmail(gmailTokens: GmailTokens, to: String, subject: String, body draftBody: String) async throws {
        struct Body: Encodable {
            let gmailTokens: GmailTokens
            let to: String
            let subject: String
            let body: String
        }
        let body = try encoder.encode(Body(gmailTokens: gmailTokens, to: to, subject: subject, body: draftBody))
        let request = try request(path: "/api/gmail/send", method: "POST", body: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
    }

    private static func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown server error"
            throw JarvisAPIError.server(message)
        }
    }
}
