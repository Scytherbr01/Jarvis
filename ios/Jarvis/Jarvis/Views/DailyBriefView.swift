import SwiftUI

struct DailyBriefView: View {
    @StateObject private var viewModel = DailyBriefViewModel()
    @StateObject private var speech = BriefSpeechService.shared
    @State private var showingAskJarvis = false

    var body: some View {
        NavigationStack {
            ZStack {
                JarvisHUDBackground()

                if viewModel.isLoading && viewModel.brief == nil {
                    VStack(spacing: 16) {
                        JarvisOrb(isActive: true, size: 140)
                        Text("Building your brief…").foregroundStyle(JarvisTheme.textSecondary)
                    }
                } else if let message = viewModel.errorMessage, viewModel.brief == nil {
                    ContentUnavailableView("Nothing to show yet", systemImage: "sun.horizon", description: Text(message))
                        .foregroundStyle(JarvisTheme.textSecondary)
                } else if let brief = viewModel.brief {
                    ScrollView {
                        VStack(spacing: 24) {
                            Text(brief.greeting.uppercased())
                                .font(.system(size: 12, weight: .bold, design: .monospaced))
                                .tracking(2)
                                .foregroundStyle(JarvisTheme.accent)
                                .padding(.top, 12)

                            HStack(alignment: .center, spacing: 10) {
                                VStack(spacing: 10) {
                                    HUDPanel(title: "MARKET") { MarketPanelContent(market: brief.market) }
                                    HUDPanel(title: "EMAILS") { EmailsPanelContent(emails: brief.emails) }
                                }
                                .frame(maxWidth: .infinity)

                                Button {
                                    speech.isSpeaking ? speech.stop() : speech.speak(brief)
                                } label: {
                                    VStack(spacing: 10) {
                                        JarvisOrb(isActive: speech.isSpeaking, size: 148)
                                        Text(speech.isSpeaking ? "READING…" : "TAP TO READ")
                                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                                            .tracking(1.5)
                                            .foregroundStyle(JarvisTheme.textTertiary)
                                    }
                                }
                                .buttonStyle(.plain)

                                VStack(spacing: 10) {
                                    HUDPanel(title: "HEADLINES") { HeadlinesPanelContent(headlines: brief.headlines) }
                                    HUDPanel(title: "STATUS") { StatusPanelContent(connections: brief.connections) }
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .padding(.horizontal, 12)
                        }
                        .padding(.bottom, 24)
                    }
                    .refreshable { await viewModel.refresh() }
                } else {
                    ContentUnavailableView("No brief yet", systemImage: "sun.horizon", description: Text("Pull to refresh."))
                        .foregroundStyle(JarvisTheme.textSecondary)
                }
            }
            .navigationTitle("Daily Brief")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
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

/// A compact HUD data readout box — the "boxes flanking the circle."
private struct HUDPanel<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .tracking(1.2)
                .foregroundStyle(JarvisTheme.accent)
            content
        }
        .padding(10)
        .frame(maxWidth: .infinity, minHeight: 108, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(JarvisTheme.surface.opacity(0.75))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(JarvisTheme.accent.opacity(0.35), lineWidth: 1)
                )
        )
    }
}

private struct MarketPanelContent: View {
    let market: MarketBrief

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(market.tickers.prefix(3)) { ticker in
                HStack(spacing: 4) {
                    Text(ticker.symbol)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(JarvisTheme.textPrimary)
                    Spacer()
                    Text(ticker.changePercent, format: .percent.precision(.fractionLength(1)))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(tickerColor(ticker.trend))
                }
            }
            if market.tickers.isEmpty {
                Text("No data").font(.system(size: 10)).foregroundStyle(JarvisTheme.textTertiary)
            }
        }
    }

    private func tickerColor(_ trend: TickerSnapshot.Trend) -> Color {
        switch trend {
        case .bullish: return JarvisTheme.success
        case .bearish: return JarvisTheme.danger
        case .neutral: return JarvisTheme.textSecondary
        }
    }
}

private struct EmailsPanelContent: View {
    let emails: [EmailHighlight]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if emails.isEmpty {
                Text("None important").font(.system(size: 10)).foregroundStyle(JarvisTheme.textTertiary)
            } else {
                ForEach(emails.prefix(2)) { email in
                    VStack(alignment: .leading, spacing: 1) {
                        Text(email.subject)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(JarvisTheme.textPrimary)
                            .lineLimit(2)
                        Text(email.from)
                            .font(.system(size: 9))
                            .foregroundStyle(JarvisTheme.textTertiary)
                            .lineLimit(1)
                    }
                }
            }
        }
    }
}

private struct HeadlinesPanelContent: View {
    let headlines: [NewsHeadline]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if headlines.isEmpty {
                Text("No headlines").font(.system(size: 10)).foregroundStyle(JarvisTheme.textTertiary)
            } else {
                ForEach(headlines.prefix(2)) { headline in
                    VStack(alignment: .leading, spacing: 1) {
                        Text(headline.title)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(JarvisTheme.textPrimary)
                            .lineLimit(2)
                        Text(headline.source)
                            .font(.system(size: 9))
                            .foregroundStyle(JarvisTheme.textTertiary)
                    }
                }
            }
        }
    }
}

private struct StatusPanelContent: View {
    let connections: [Connection]

    var body: some View {
        let active = connections.filter(\.available).count
        VStack(alignment: .leading, spacing: 4) {
            Text("\(active)/\(connections.count) LINKED")
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(JarvisTheme.textPrimary)
            ForEach(connections) { connection in
                HStack(spacing: 5) {
                    Circle()
                        .fill(connection.available ? JarvisTheme.success : JarvisTheme.textTertiary)
                        .frame(width: 5, height: 5)
                    Text(connection.name)
                        .font(.system(size: 9))
                        .foregroundStyle(JarvisTheme.textSecondary)
                }
            }
        }
    }
}

#Preview {
    DailyBriefView()
}
