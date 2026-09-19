import SwiftUI

/// Dark-only palette modeled on the Iron Man J.A.R.V.I.S. HUD: near-black
/// background, glowing cyan-blue accent, no light variant. The app forces
/// dark mode at the root (see JarvisApp.swift) so this is the only palette
/// that ever renders.
enum JarvisTheme {
    static let background = Color(red: 0.02, green: 0.04, blue: 0.08)
    static let surface = Color(red: 0.06, green: 0.09, blue: 0.15)
    static let surfaceElevated = Color(red: 0.09, green: 0.13, blue: 0.20)
    static let divider = Color(red: 0.16, green: 0.24, blue: 0.31)
    static let gridLine = Color(red: 0.08, green: 0.16, blue: 0.23)

    static let accent = Color(red: 0.15, green: 0.80, blue: 1.0)
    static let accentDim = accent.opacity(0.5)
    static let accentGlow = accent.opacity(0.35)

    static let textPrimary = Color(red: 0.90, green: 0.96, blue: 1.0)
    static let textSecondary = Color(red: 0.52, green: 0.64, blue: 0.74)
    static let textTertiary = Color(red: 0.35, green: 0.45, blue: 0.54)

    static let success = Color(red: 0.25, green: 0.95, blue: 0.65)
    static let danger = Color(red: 1.0, green: 0.33, blue: 0.33)
    static let warning = Color(red: 1.0, green: 0.68, blue: 0.15)
}

/// Standard "HUD card" background for content blocks throughout the app.
struct JarvisCardBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(JarvisTheme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(JarvisTheme.accent.opacity(0.15), lineWidth: 1)
                    )
            )
    }
}

extension View {
    func jarvisCard() -> some View { modifier(JarvisCardBackground()) }
}
