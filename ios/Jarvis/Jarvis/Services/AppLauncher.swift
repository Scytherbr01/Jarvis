import UIKit

enum AppLauncherError: Error {
    case appNotFound(String)
    case cannotOpen
}

/// Opens other installed apps by name and initiates phone calls.
///
/// Two hard iOS limits, enforced by the OS itself, not by this code:
/// - Placing a call via `tel:` always shows a system confirmation before
///   dialing. There is no API for a third-party app to bypass that, by
///   design (anti-fraud/anti-spam).
/// - There's no way to detect whether an app is installed beyond checking
///   its declared URL scheme, and only schemes listed in this app's
///   `LSApplicationQueriesSchemes` (see Info.plist) can even be checked.
enum AppLauncher {
    @MainActor
    static func open(appNamed name: String) async throws {
        guard let url = CommandRouter.urlScheme(forAppNamed: name) else {
            throw AppLauncherError.appNotFound(name)
        }
        guard await UIApplication.shared.canOpenURL(url) else {
            throw AppLauncherError.appNotFound(name)
        }
        let opened = await UIApplication.shared.open(url)
        if !opened { throw AppLauncherError.cannotOpen }
    }

    /// Opens the system dialer pre-filled with `number`. iOS still shows
    /// its own "Call [number]?" confirmation — that step can't be skipped.
    @MainActor
    static func dial(_ number: String) async throws {
        let digits = number.filter { $0.isNumber || $0 == "+" }
        guard let url = URL(string: "tel://\(digits)"), await UIApplication.shared.canOpenURL(url) else {
            throw AppLauncherError.cannotOpen
        }
        let opened = await UIApplication.shared.open(url)
        if !opened { throw AppLauncherError.cannotOpen }
    }
}
