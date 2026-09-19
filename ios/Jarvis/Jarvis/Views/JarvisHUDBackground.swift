import SwiftUI

/// The faint cyan grid behind every screen — the targeting-HUD backdrop
/// from the reference look. Drawn once per screen size with Canvas rather
/// than a tiled image so it stays crisp at any device size.
struct JarvisHUDBackground: View {
    var body: some View {
        Canvas { context, size in
            let spacing: CGFloat = 28
            var x: CGFloat = 0
            while x <= size.width {
                var path = Path()
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                context.stroke(path, with: .color(JarvisTheme.gridLine), lineWidth: 0.5)
                x += spacing
            }
            var y: CGFloat = 0
            while y <= size.height {
                var path = Path()
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                context.stroke(path, with: .color(JarvisTheme.gridLine), lineWidth: 0.5)
                y += spacing
            }
        }
        .background(JarvisTheme.background)
        .ignoresSafeArea()
    }
}

#Preview {
    JarvisHUDBackground()
}
