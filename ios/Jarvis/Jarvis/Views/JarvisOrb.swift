import SwiftUI

/// The glowing blue orb, the app's visual signature. Breathes slowly at
/// rest; when `isActive` is true (TTS speaking, or the mic listening) it
/// brightens and sends out expanding rings, roughly like J.A.R.V.I.S.'s
/// arc-reactor HUD responding while it talks.
struct JarvisOrb: View {
    var isActive: Bool
    var size: CGFloat = 120

    @State private var breathe = false
    @State private var ringPhase = false

    var body: some View {
        ZStack {
            if isActive {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .stroke(JarvisTheme.accent.opacity(0.5), lineWidth: 2)
                        .scaleEffect(ringPhase ? 1.7 : 0.85)
                        .opacity(ringPhase ? 0 : 0.9)
                        .animation(
                            .easeOut(duration: 1.3)
                                .repeatForever(autoreverses: false)
                                .delay(Double(i) * 0.35),
                            value: ringPhase
                        )
                }
            }

            Circle()
                .fill(
                    RadialGradient(
                        colors: [JarvisTheme.accent, JarvisTheme.accent.opacity(0.1)],
                        center: .center,
                        startRadius: 1,
                        endRadius: size * 0.32
                    )
                )
                .frame(width: size * 0.5, height: size * 0.5)
                .shadow(color: JarvisTheme.accent.opacity(isActive ? 0.9 : 0.45), radius: isActive ? 28 : 14)
                .scaleEffect(breathe ? 1.05 : 0.95)
                .animation(
                    .easeInOut(duration: isActive ? 0.5 : 1.8).repeatForever(autoreverses: true),
                    value: breathe
                )
        }
        .frame(width: size, height: size)
        .onAppear {
            breathe = true
            ringPhase = true
        }
    }
}

#Preview {
    ZStack {
        JarvisTheme.background.ignoresSafeArea()
        JarvisOrb(isActive: true)
    }
}
