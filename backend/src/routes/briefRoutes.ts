import { Router } from "express";
import { runDailyBrief } from "../agent/dailyBriefAgent.js";
import { buildAuthUrl, exchangeCodeForTokens } from "../services/gmailService.js";
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
