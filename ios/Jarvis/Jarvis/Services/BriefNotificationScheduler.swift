import Foundation
import UserNotifications

/// Schedules a local notification at the user's chosen daily-brief time.
/// This is the client-side half of "run the daily brief routine": even
/// without the APNs push wired up on the backend, the app will fetch a
/// fresh brief and notify the user at the same time every day.
enum BriefNotificationScheduler {
    static let notificationIdentifier = "com.jarvis.dailyBrief"

    static func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    static func scheduleDaily(at time: DateComponents) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationIdentifier])

        let content = UNMutableNotificationContent()
        content.title = "Your Jarvis daily brief is ready"
        content.body = "Tap to see today's emails, market moves, and headlines."
        content.sound = .default

        let trigger = UNCalendarNotificationTrigger(dateMatching: time, repeats: true)
        let request = UNNotificationRequest(identifier: notificationIdentifier, content: content, trigger: trigger)
        center.add(request)
    }

    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationIdentifier])
    }
}
