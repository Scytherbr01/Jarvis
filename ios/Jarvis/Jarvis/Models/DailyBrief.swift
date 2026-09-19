import Foundation

struct DailyBrief: Codable {
    let generatedAt: Date
    let greeting: String
    let emails: [EmailHighlight]
    let market: MarketBrief
    let headlines: [NewsHeadline]
    let connections: [Connection]
}

struct EmailHighlight: Codable, Identifiable {
    let id: String
    let from: String
    let subject: String
    let snippet: String
    let receivedAt: String
    let isImportant: Bool
    let isUnread: Bool
}

struct MarketBrief: Codable {
    let generatedAt: Date
    let tickers: [TickerSnapshot]
    let advice: String
}

struct TickerSnapshot: Codable, Identifiable {
    var id: String { symbol }
    let symbol: String
    let price: Double
    let changePercent: Double
    let fiftyDayAvg: Double?
    let trend: Trend
    let note: String

    enum Trend: String, Codable {
        case bullish, bearish, neutral

        var symbolName: String {
            switch self {
            case .bullish: return "arrow.up.right.circle.fill"
            case .bearish: return "arrow.down.right.circle.fill"
            case .neutral: return "minus.circle.fill"
            }
        }
    }
}

struct NewsHeadline: Codable, Identifiable {
    var id: String { url }
    let title: String
    let source: String
    let url: String
    let publishedAt: String
}

struct Connection: Codable, Identifiable {
    var id: String
    let name: String
    let available: Bool
    let reason: String?
}

struct EmailDraft: Codable {
    var subject: String
    var body: String
}
