import SwiftUI

@main
struct JarvisApp: App {
    init() {
        UINavigationBar.appearance().largeTitleTextAttributes = [.foregroundColor: UIColor(JarvisTheme.textPrimary)]
        UINavigationBar.appearance().titleTextAttributes = [.foregroundColor: UIColor(JarvisTheme.textPrimary)]
    }

    var body: some Scene {
        WindowGroup {
            DailyBriefView()
                // No light mode, ever — this is a fixed dark HUD theme,
                // not a "dark mode" that follows the system setting.
                .preferredColorScheme(.dark)
                .tint(JarvisTheme.accent)
        }
    }
}
