import SwiftUI

struct DailyBriefView: View {
    @StateObject private var viewModel = DailyBriefViewModel()
    @StateObject private var speech = BriefSpeechService.shared
    @State private var showingAskJarvis = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.brief == nil {
                    VStack(spacing: 16) {
                        JarvisOrb(isActive: true, size: 80)
                        Text("Building your brief…").foregroundStyle(JarvisTheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let message = viewModel.errorMessage, viewModel.brief == nil {
                    ContentUnavailableView("Nothing to show yet", systemImage: "sun.horizon", description: Text(message))
                        .foregroundStyle(JarvisTheme.textSecondary)
                } else if let brief = viewModel.brief {
                    List {
                        Section {
                            HStack(spacing: 14) {
                                JarvisOrb(isActive: speech.isSpeaking, size: 44)
                                Text(brief.greeting)
                                    .font(.title2.bold())
                                    .foregroundStyle(JarvisTheme.textPrimary)
                            }
                        }
                        .listRowBackground(Color.clear)

                        Section {
                            Text(brief.market.advice)
                                .font(.subheadline)
                                .foregroundStyle(JarvisTheme.textSecondary)
                            ForEach(brief.market.tickers) { ticker in
                                TickerRow(ticker: ticker)
                            }
                        } header: {
                            Text("Market").foregroundStyle(JarvisTheme.accent)
                        }
                        .listRowBackground(JarvisTheme.surface)

                        Section {
                            if brief.emails.isEmpty {
                                Text("Nothing flagged important in the last 24 hours.")
                                    .foregroundStyle(JarvisTheme.textSecondary)
                            } else {
                                ForEach(brief.emails) { email in
                                    EmailRow(email: email)
                                }
                            }
                        } header: {
                            Text("Important Emails").foregroundStyle(JarvisTheme.accent)
                        }
                        .listRowBackground(JarvisTheme.surface)

                        Section {
                            ForEach(brief.headlines) { headline in
                                Link(destination: URL(string: headline.url) ?? URL(string: "https://news.google.com")!) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(headline.title).font(.subheadline).foregroundStyle(JarvisTheme.textPrimary)
                                        Text(headline.source).font(.caption).foregroundStyle(JarvisTheme.textSecondary)
                                    }
                                }
                            }
                        } header: {
                            Text("Headlines").foregroundStyle(JarvisTheme.accent)
                        }
                        .listRowBackground(JarvisTheme.surface)
                    }
                    .listRowSeparatorTint(JarvisTheme.divider)
                    .scrollContentBackground(.hidden)
                    .refreshable { await viewModel.refresh() }
                } else {
                    ContentUnavailableView("No brief yet", systemImage: "sun.horizon", description: Text("Pull to refresh."))
                        .foregroundStyle(JarvisTheme.textSecondary)
                }
            }
            .background(JarvisTheme.background.ignoresSafeArea())
            .navigationTitle("Daily Brief")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                if let brief = viewModel.brief {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            speech.isSpeaking ? speech.stop() : speech.speak(brief)
                        } label: {
                            Image(systemName: speech.isSpeaking ? "stop.circle.fill" : "play.circle.fill")
                                .foregroundStyle(JarvisTheme.accent)
                        }
                        .accessibilityLabel(speech.isSpeaking ? "Stop reading brief" : "Read brief aloud")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(destination: SettingsView()) {
                        Image(systemName: "gearshape")
                            .foregroundStyle(JarvisTheme.accent)
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
                        .foregroundStyle(JarvisTheme.background)
                }
                .background(JarvisTheme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(color: JarvisTheme.accentGlow, radius: 16)
                .padding()
                .background(JarvisTheme.background)
            }
            .sheet(isPresented: $showingAskJarvis) { AskJarvisView() }
            .task { await viewModel.refresh() }
            .onDisappear { speech.stop() }
        }
        .preferredColorScheme(.dark)
    }
}

private struct TickerRow: View {
    let ticker: TickerSnapshot

    var body: some View {
        HStack {
            Image(systemName: ticker.trend.symbolName)
                .foregroundStyle(color)
            VStack(alignment: .leading) {
                Text(ticker.symbol).font(.headline).foregroundStyle(JarvisTheme.textPrimary)
                Text(ticker.note).font(.caption).foregroundStyle(JarvisTheme.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing) {
                Text(ticker.price, format: .currency(code: "USD"))
                    .foregroundStyle(JarvisTheme.textPrimary)
                Text(ticker.changePercent, format: .percent.precision(.fractionLength(2)))
                    .foregroundStyle(color)
            }
            .font(.subheadline)
        }
    }

    private var color: Color {
        switch ticker.trend {
        case .bullish: return JarvisTheme.success
        case .bearish: return JarvisTheme.danger
        case .neutral: return JarvisTheme.textSecondary
        }
    }
}

private struct EmailRow: View {
    let email: EmailHighlight

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(email.subject).font(.subheadline.weight(.semibold)).foregroundStyle(JarvisTheme.textPrimary)
            Text(email.from).font(.caption).foregroundStyle(JarvisTheme.textSecondary)
            Text(email.snippet).font(.caption).foregroundStyle(JarvisTheme.textTertiary).lineLimit(2)
        }
    }
}

#Preview {
    DailyBriefView()
}
