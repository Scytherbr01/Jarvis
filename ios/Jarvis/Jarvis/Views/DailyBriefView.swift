import SwiftUI

struct DailyBriefView: View {
    @StateObject private var viewModel = DailyBriefViewModel()
    @StateObject private var speech = BriefSpeechService.shared
    @State private var showingAskJarvis = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.brief == nil {
                    ProgressView("Building your brief…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let message = viewModel.errorMessage, viewModel.brief == nil {
                    ContentUnavailableView("Nothing to show yet", systemImage: "sun.horizon", description: Text(message))
                } else if let brief = viewModel.brief {
                    List {
                        Section {
                            Text(brief.greeting)
                                .font(.title2.bold())
                        }

                        Section("Market") {
                            Text(brief.market.advice)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            ForEach(brief.market.tickers) { ticker in
                                TickerRow(ticker: ticker)
                            }
                        }

                        Section("Important Emails") {
                            if brief.emails.isEmpty {
                                Text("Nothing flagged important in the last 24 hours.")
                                    .foregroundStyle(.secondary)
                            } else {
                                ForEach(brief.emails) { email in
                                    EmailRow(email: email)
                                }
                            }
                        }

                        Section("Headlines") {
                            ForEach(brief.headlines) { headline in
                                Link(destination: URL(string: headline.url) ?? URL(string: "https://news.google.com")!) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(headline.title).font(.subheadline)
                                        Text(headline.source).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                    .refreshable { await viewModel.refresh() }
                } else {
                    ContentUnavailableView("No brief yet", systemImage: "sun.horizon", description: Text("Pull to refresh."))
                }
            }
            .navigationTitle("Daily Brief")
            .toolbar {
                if let brief = viewModel.brief {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            speech.isSpeaking ? speech.stop() : speech.speak(brief)
                        } label: {
                            Image(systemName: speech.isSpeaking ? "stop.circle.fill" : "play.circle.fill")
                        }
                        .accessibilityLabel(speech.isSpeaking ? "Stop reading brief" : "Read brief aloud")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(destination: SettingsView()) {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    showingAskJarvis = true
                } label: {
                    Label("Ask Jarvis", systemImage: "mic.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.borderedProminent)
                .padding()
            }
            .sheet(isPresented: $showingAskJarvis) { AskJarvisView() }
            .task { await viewModel.refresh() }
            .onDisappear { speech.stop() }
        }
    }
}

private struct TickerRow: View {
    let ticker: TickerSnapshot

    var body: some View {
        HStack {
            Image(systemName: ticker.trend.symbolName)
                .foregroundStyle(color)
            VStack(alignment: .leading) {
                Text(ticker.symbol).font(.headline)
                Text(ticker.note).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing) {
                Text(ticker.price, format: .currency(code: "USD"))
                Text(ticker.changePercent, format: .percent.precision(.fractionLength(2)))
                    .foregroundStyle(color)
            }
            .font(.subheadline)
        }
    }

    private var color: Color {
        switch ticker.trend {
        case .bullish: return .green
        case .bearish: return .red
        case .neutral: return .secondary
        }
    }
}

private struct EmailRow: View {
    let email: EmailHighlight

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(email.subject).font(.subheadline.weight(.semibold))
            Text(email.from).font(.caption).foregroundStyle(.secondary)
            Text(email.snippet).font(.caption).lineLimit(2)
        }
    }
}

#Preview {
    DailyBriefView()
}
