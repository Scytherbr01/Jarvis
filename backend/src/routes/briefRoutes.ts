import { Router } from "express";
import { runDailyBrief } from "../agent/dailyBriefAgent.js";
import { buildAuthUrl, exchangeCodeForTokens, sendEmail } from "../services/gmailService.js";
import { composeEmail, composeText } from "../services/composeService.js";
import { CONNECTIONS } from "../services/connections.js";

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
