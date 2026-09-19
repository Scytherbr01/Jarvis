import { config } from "../config.js";

/**
 * Places an actual phone call via Twilio's REST API, using inline TwiML
 * so no public webhook endpoint is needed for the simple "read this
 * message aloud" case. Calls the plain REST API with fetch rather than
 * pulling in the Twilio SDK — one HTTP call, no extra dependency.
 *
 * Twilio is a paid service (a phone number rental plus per-minute
 * charges). This only ever runs when config.twilioConfigured is true,
 * i.e. once real credentials are set — see backend/README.md.
 */
export async function placeAlertCall(message: string): Promise<{ sid: string }> {
  if (!config.twilioConfigured) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, and CALL_TO_NUMBER.");
  }

  const twiml = `<Response><Say voice="Polly.Matthew">${escapeXml(message)}</Say></Response>`;

  const body = new URLSearchParams({
    To: config.twilio.callToNumber,
    From: config.twilio.fromNumber,
    Twiml: twiml,
  });

  const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? `Twilio API error (${res.status})`);
  }
  return { sid: data.sid ?? "" };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
