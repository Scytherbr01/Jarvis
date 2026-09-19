import SwiftUI

/// The reactor — the app's visual centerpiece, modeled on the Iron Man
/// J.A.R.V.I.S. targeting HUD: a thick partial dial ring, a dashed inner
/// ring, a tick-marked outer collar, and a glowing core. Everything spins
/// slowly at rest; when `isActive` is true (TTS speaking, or the mic
/// listening) the rings spin faster and the core pulses brighter and
/// quicker, so the whole thing visibly moves in time with speech.
struct JarvisOrb: View {
    var isActive: Bool
    var size: CGFloat = 120

    @State private var dialRotation = 0.0
    @State private var tickRotation = 0.0
    @State private var corePulse = false

    var body: some View {
        ZStack {
            // Outer tick collar — alternating long/short ticks, like a
            // targeting reticle's calibration marks.
            ZStack {
                ForEach(0..<48, id: \.self) { i in
                    Rectangle()
                        .fill(JarvisTheme.accent.opacity(i % 4 == 0 ? 0.9 : 0.35))
                        .frame(width: i % 4 == 0 ? 2.5 : 1.5, height: i % 4 == 0 ? size * 0.045 : size * 0.028)
                        .offset(y: -size * 0.5 + size * 0.03)
                        .rotationEffect(.degrees(Double(i) * (360.0 / 48.0)))
                }
            }
            .rotationEffect(.degrees(tickRotation))

            // Primary dial — a thick partial arc, the main "spinning ring".
            Circle()
                .trim(from: 0.04, to: 0.8)
                .stroke(
                    AngularGradient(colors: [JarvisTheme.accent.opacity(0.15), JarvisTheme.accent], center: .center),
                    style: StrokeStyle(lineWidth: size * 0.05, lineCap: .round)
                )
                .frame(width: size * 0.84, height: size * 0.84)
                .rotationEffect(.degrees(dialRotation))
                .shadow(color: JarvisTheme.accent.opacity(isActive ? 0.9 : 0.5), radius: isActive ? 18 : 8)

            // Secondary dashed ring, counter-rotating.
            Circle()
                .stroke(JarvisTheme.accent.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [4, 7]))
                .frame(width: size * 0.6, height: size * 0.6)
                .rotationEffect(.degrees(-dialRotation * 1.6))

            // Glowing core with a faint crosshair cut into it.
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [JarvisTheme.accent, JarvisTheme.accent.opacity(0.08)],
                            center: .center,
                            startRadius: 1,
                            endRadius: size * 0.17
                        )
                    )
                    .frame(width: size * 0.34, height: size * 0.34)
                    .shadow(color: JarvisTheme.accent.opacity(isActive ? 1 : 0.5), radius: isActive ? 26 : 12)
                    .scaleEffect(corePulse ? 1.08 : 0.92)

                Rectangle().fill(JarvisTheme.background).frame(width: size * 0.34, height: 1.5)
                Rectangle().fill(JarvisTheme.background).frame(width: 1.5, height: size * 0.34)
            }
        }
        .frame(width: size, height: size)
        .onAppear { restartAnimations() }
        .onChange(of: isActive) { _, _ in restartAnimations() }
    }

    private func restartAnimations() {
        withAnimation(.linear(duration: isActive ? 4 : 16).repeatForever(autoreverses: false)) {
            dialRotation += 360
        }
        withAnimation(.linear(duration: isActive ? 7 : 26).repeatForever(autoreverses: false)) {
            tickRotation += 360
        }
        corePulse = false
        withAnimation(.easeInOut(duration: isActive ? 0.45 : 1.8).repeatForever(autoreverses: true)) {
            corePulse = true
        }
    }
}

#Preview {
    ZStack {
        JarvisHUDBackground()
        JarvisOrb(isActive: true, size: 220)
    }
}
