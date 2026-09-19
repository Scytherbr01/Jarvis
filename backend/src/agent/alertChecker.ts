import { config } from "../config.js";
import { getMarketBrief } from "../services/marketService.js";
import { placeAlertCall } from "../services/twilioService.js";
import type { GmailTokens } from "../services/gmailService.js";
import { getImportantEmails } from "../services/gmailService.js";

// In-memory cooldown — resets on server restart, which is an accepted
// tradeoff for a single-process personal deployment rather than adding a
// database just to remember "did I already call about this."
const lastCallAt = new Map<string, number>();

function pastCooldown(key: string): boolean {
  const last = lastCallAt.get(key);
  if (!last) return true;
  return Date.now() - last > config.alerts.cooldownMinutes * 60 * 1000;
}

function markCalled(key: string) {
  lastCallAt.set(key, Date.now());
}

export interface AlertCheckInput {
  gmailTokens?: GmailTokens;
}

/**
 * Runs on ALERT_CHECK_CRON. Calls you only when something crosses a
 * threshold you configured, and only once per cooldown window per kind
 * of alert — never spams a call for the same condition repeatedly.
 */
export async function checkAndCallIfUrgent(input: AlertCheckInput): Promise<void> {
  if (!config.twilioConfigured) return;

  const market = await getMarketBrief();
  const mover = market.tickers.find((t) => Math.abs(t.changePercent) >= config.alerts.marketMoveThresholdPercent);
  if (mover && pastCooldown("market")) {
    await placeAlertCall(
      `This is Jarvis with an urgent market alert. ${mover.symbol} has moved ${mover.changePercent.toFixed(1)} percent today. ${mover.note}`
    );
    markCalled("market");
  }

  if (config.alerts.callOnUrgentEmail && input.gmailTokens) {
    const emails = await getImportantEmails(input.gmailTokens, 5);
    if (emails.length > 0 && pastCooldown("email")) {
      const first = emails[0];
      await placeAlertCall(
        `This is Jarvis. You have an important email from ${first.from}, subject: ${first.subject}.`
      );
      markCalled("email");
    }
  }
}
