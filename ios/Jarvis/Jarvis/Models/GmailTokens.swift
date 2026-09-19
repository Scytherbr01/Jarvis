import Foundation

struct GmailTokens: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiryDate: Double?
}
