// Thin client for the Jarvis backend (../backend). Mirrors JarvisAPIClient.swift
// so the mobile app talks to exactly the same endpoints as the iOS build.
const JarvisAPI = (() => {
  function baseUrl() {
    return (Prefs.get("backendUrl") || "").replace(/\/+$/, "");
  }
  function apiKey() {
    return Prefs.get("apiKey") || "";
  }

  async function request(path, { method = "GET", body } = {}) {
    const base = baseUrl();
    const key = apiKey();
    if (!base || !key) throw new JarvisAPIError("NOT_CONFIGURED", "Connect your Jarvis backend in Settings first.");

    let res;
    try {
      res = await fetch(base + path, {
        method,
        headers: {
          "x-jarvis-key": key,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new JarvisAPIError("NETWORK", "Couldn't reach the backend: " + err.message);
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new JarvisAPIError("SERVER", data.error || `Server error (${res.status})`);
    return data;
  }

  class JarvisAPIError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  return {
    JarvisAPIError,
    fetchDailyBrief: (gmailTokens, watchlist) =>
      request("/api/daily-brief", { method: "POST", body: { gmailTokens, watchlist } }),
    fetchConnections: () => request("/api/connections"),
    gmailAuthUrl: () => request("/api/oauth/gmail/url"),
    exchangeGmailCode: (code) => request("/api/oauth/gmail/exchange", { method: "POST", body: { code } }),
    composeEmail: (recipientName, recipientEmail, topic) =>
      request("/api/compose/email", { method: "POST", body: { recipientName, recipientEmail, topic } }),
    composeText: (recipientName, topic) =>
      request("/api/compose/text", { method: "POST", body: { recipientName, topic } }),
    sendEmail: (gmailTokens, to, subject, body) =>
      request("/api/gmail/send", { method: "POST", body: { gmailTokens, to, subject, body } }),
  };
})();
