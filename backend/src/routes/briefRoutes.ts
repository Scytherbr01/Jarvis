import { Router } from "express";
import { config } from "../config.js";
import { runDailyBrief } from "../agent/dailyBriefAgent.js";
import { buildAuthUrl, exchangeCodeForTokens, sendEmail } from "../services/gmailService.js";
import { composeEmail, composeText } from "../services/composeService.js";
import { placeAlertCall } from "../services/twilioService.js";
import { CONNECTIONS } from "../services/connections.js";
import { runtimeState } from "../state/runtimeState.js";
import { dispatchAgentCommand } from "../agent/agentDispatcher.js";
import { draftYouTubeContent } from "../agent/contentAgent.js";
import { buildYouTubeAuthUrl, exchangeYouTubeCode, uploadVideo } from "../services/youtubeService.js";

export const briefRoutes = Router();

/**
 * Body: { gmailTokens?: { accessToken, refreshToken, expiryDate }, watchlist?: string[] }
 * The iOS app stores the Gmail refresh token in the Keychain and sends the
 * current access token (refreshing it client-side) on each request.
 */
briefRoutes.post("/daily-brief", async (req, res) => {
  try {
    const brief = await runDailyBrief({
      gmailTokens: req.body?.gmailTokens,
      watchlist: req.body?.watchlist,
    });
    res.json(brief);
  } catch (err) {
    console.error("Failed to build daily brief", err);
    res.status(500).json({ error: "Failed to build daily brief." });
  }
});

briefRoutes.get("/connections", (_req, res) => {
  res.json(CONNECTIONS);
});

briefRoutes.get("/oauth/gmail/url", (_req, res) => {
  res.json({ url: buildAuthUrl() });
});

briefRoutes.post("/oauth/gmail/exchange", async (req, res) => {
  const code = req.body?.code;
  if (!code) {
    res.status(400).json({ error: "Missing `code` in request body." });
    return;
  }
  try {
    const tokens = await exchangeCodeForTokens(code);
    if (process.env.GMAIL_LOG_REFRESH_TOKEN === "true" && tokens.refreshToken) {
      // One-time convenience for wiring up the unattended alert-check
      // cron — see GMAIL_SERVER_REFRESH_TOKEN in config.ts. Never log
      // this by default.
      console.log(`[gmail] refresh token (copy into GMAIL_SERVER_REFRESH_TOKEN): ${tokens.refreshToken}`);
    }
    res.json(tokens);
  } catch (err) {
    console.error("Gmail token exchange failed", err);
    res.status(500).json({ error: "Gmail token exchange failed." });
  }
});

/**
 * Body: { recipientName?, recipientEmail?, topic, instructions? }
 * Drafts only — never sends. The app reads this back and only calls
 * /gmail/send once the user has explicitly approved it.
 */
briefRoutes.post("/compose/email", async (req, res) => {
  const { recipientName, recipientEmail, topic, instructions } = req.body ?? {};
  if (!topic) {
    res.status(400).json({ error: "Missing `topic` in request body." });
    return;
  }
  try {
    const draft = await composeEmail({ recipientName, recipientEmail, topic, instructions });
    res.json(draft);
  } catch (err) {
    console.error("Email compose failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Email compose failed." });
  }
});

/**
 * Body: { recipientName?, topic, instructions? }
 * Drafts only. The app can only pre-fill the Messages compose sheet —
 * iOS requires the user to tap Send themselves.
 */
briefRoutes.post("/compose/text", async (req, res) => {
  const { recipientName, topic, instructions } = req.body ?? {};
  if (!topic) {
    res.status(400).json({ error: "Missing `topic` in request body." });
    return;
  }
  try {
    const draft = await composeText({ recipientName, topic, instructions });
    res.json(draft);
  } catch (err) {
    console.error("Text compose failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Text compose failed." });
  }
});

/**
 * Body: { gmailTokens, to, subject, body }
 * Requires the gmail.send-scoped Gmail tokens obtained via the OAuth
 * flow above (re-run /oauth/gmail if the stored tokens predate the send
 * scope being added).
 */
briefRoutes.post("/gmail/send", async (req, res) => {
  const { gmailTokens, to, subject, body } = req.body ?? {};
  if (!gmailTokens || !to || !subject || !body) {
    res.status(400).json({ error: "Missing gmailTokens, to, subject, or body." });
    return;
  }
  try {
    const result = await sendEmail(gmailTokens, { to, subject, body });
    res.json(result);
  } catch (err) {
    console.error("Gmail send failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Gmail send failed." });
  }
});

/**
 * Body: { transcript }
 * The AI subagent dispatcher: Claude picks which subagent (draft_email,
 * draft_text, place_call, open_app, create_youtube_content) a spoken
 * command means, using real tool-calling rather than keyword matching.
 * The app acts on the result; this endpoint never performs the action
 * itself.
 */
briefRoutes.post("/agent/dispatch", async (req, res) => {
  const { transcript } = req.body ?? {};
  if (!transcript) {
    res.status(400).json({ error: "Missing `transcript` in request body." });
    return;
  }
  try {
    const result = await dispatchAgentCommand(transcript);
    res.json(result);
  } catch (err) {
    console.error("Agent dispatch failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Agent dispatch failed." });
  }
});

briefRoutes.get("/oauth/youtube/url", (_req, res) => {
  res.json({ url: buildYouTubeAuthUrl() });
});

briefRoutes.post("/oauth/youtube/exchange", async (req, res) => {
  const code = req.body?.code;
  if (!code) {
    res.status(400).json({ error: "Missing `code` in request body." });
    return;
  }
  try {
    const tokens = await exchangeYouTubeCode(code);
    res.json(tokens);
  } catch (err) {
    console.error("YouTube token exchange failed", err);
    res.status(500).json({ error: "YouTube token exchange failed." });
  }
});

/**
 * Body: { topic }
 * The Content subagent: drafts title/description/tags/script for a
 * YouTube video on the given topic. Drafts only — never posts.
 */
briefRoutes.post("/content/draft", async (req, res) => {
  const { topic } = req.body ?? {};
  if (!topic) {
    res.status(400).json({ error: "Missing `topic` in request body." });
    return;
  }
  try {
    const draft = await draftYouTubeContent(topic);
    res.json(draft);
  } catch (err) {
    console.error("Content draft failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Content draft failed." });
  }
});

/**
 * Body: { youtubeTokens, sourceUrl, title, description, tags?, privacyStatus? }
 * Posts a video that already exists at `sourceUrl` (Jarvis packages and
 * uploads it — it never generates footage). Requires YouTube tokens from
 * the OAuth flow above.
 */
briefRoutes.post("/youtube/upload", async (req, res) => {
  const { youtubeTokens, sourceUrl, title, description, tags, privacyStatus } = req.body ?? {};
  if (!youtubeTokens || !sourceUrl || !title || !description) {
    res.status(400).json({ error: "Missing youtubeTokens, sourceUrl, title, or description." });
    return;
  }
  try {
    const result = await uploadVideo(youtubeTokens, { sourceUrl, title, description, tags, privacyStatus });
    res.json(result);
  } catch (err) {
    console.error("YouTube upload failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "YouTube upload failed." });
  }
});

/**
 * Whether Twilio call-alerts are configured on this backend, and whether
 * they're currently switched on — drives the "Call me for urgent
 * updates" toggle in Settings.
 */
briefRoutes.get("/twilio/status", (_req, res) => {
  res.json({ configured: config.twilioConfigured, enabled: runtimeState.callAlertsEnabled });
});

/**
 * Body: { enabled }
 * Actually flips whether the alert-check cron is allowed to place calls
 * — this is what the app's toggle controls, not just its own local state.
 */
briefRoutes.post("/twilio/toggle", (req, res) => {
  const { enabled } = req.body ?? {};
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "Missing boolean `enabled` in request body." });
    return;
  }
  runtimeState.callAlertsEnabled = enabled;
  res.json({ configured: config.twilioConfigured, enabled: runtimeState.callAlertsEnabled });
});

/**
 * Body: { message }
 * Places a real, immediate phone call reading `message` aloud. Used by
 * the app's "Test call" button, and by the scheduled alert checker
 * internally. Costs real money per Twilio's pricing — only reachable
 * when TWILIO_* env vars are set.
 */
briefRoutes.post("/call-alert", async (req, res) => {
  const { message } = req.body ?? {};
  if (!message) {
    res.status(400).json({ error: "Missing `message` in request body." });
    return;
  }
  if (!config.twilioConfigured) {
    res.status(409).json({ error: "Twilio is not configured on this backend yet." });
    return;
  }
  try {
    const result = await placeAlertCall(message);
    res.json(result);
  } catch (err) {
    console.error("Call alert failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Call alert failed." });
  }
});
