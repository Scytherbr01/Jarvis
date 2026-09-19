/**
 * Every integration the app's Connections screen can show. `available`
 * reflects hard platform constraints, not missing effort:
 *  - Signal and iMessage/Messages deliberately expose no third-party API
 *    for reading messages or notifications (by design, for user privacy).
 *  - WickrGov is a closed, enterprise/government-controlled platform with
 *    no public API for personal integrations.
 *  - Instagram's Graph API only covers business/creator accounts, not
 *    personal DMs or notifications.
 * These stay listed so the UI is honest about what's connectable today
 * and can light up automatically if a platform ever opens an API.
 */
export type ConnectionId = "gmail" | "news" | "stocks" | "youtube" | "instagram" | "wickrgov" | "signal" | "messages";

export interface ConnectionDefinition {
  id: ConnectionId;
  name: string;
  available: boolean;
  reason?: string;
}

export const CONNECTIONS: ConnectionDefinition[] = [
  { id: "gmail", name: "Gmail", available: true },
  { id: "news", name: "News", available: true },
  { id: "stocks", name: "Stock Market", available: true },
  { id: "youtube", name: "YouTube", available: true },
  {
    id: "instagram",
    name: "Instagram",
    available: false,
    reason: "Instagram's public API only covers business/creator accounts, not personal DM notifications.",
  },
  {
    id: "wickrgov",
    name: "WickrGov",
    available: false,
    reason: "WickrGov is a closed government/enterprise platform with no public API for personal apps.",
  },
  {
    id: "signal",
    name: "Signal",
    available: false,
    reason: "Signal has no public API for reading messages or notifications — by design, for privacy.",
  },
  {
    id: "messages",
    name: "Messages",
    available: false,
    reason: "iOS does not allow third-party apps to read iMessage/SMS content or notifications.",
  },
];
