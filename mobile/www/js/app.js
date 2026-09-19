// Command parsing — a straight port of CommandRouter.swift so voice
// commands behave identically to the iOS build.
const CommandRouter = (() => {
  const openAppSchemes = {
    instagram: "instagram://app",
    messages: "sms:",
    phone: "tel:",
    signal: "sgnl://",
    gmail: "googlegmail://",
    maps: "geo:0,0?q=",
  };

  function route(rawTranscript) {
    const transcript = (rawTranscript || "").trim();
    const lower = transcript.toLowerCase();

    let match = extractAfter(["write an email", "draft an email", "send an email", "email"], transcript);
    if (match) {
      const { recipient, topic } = splitRecipientAndTopic(match);
      return { type: "composeEmail", recipient, topic };
    }

    match = extractAfter(["send a text", "draft a text", "text", "message"], transcript);
    if (match) {
      const { recipient, topic } = splitRecipientAndTopic(match);
      return { type: "composeText", recipient, topic };
    }

    match = extractAfter(["call"], transcript);
    if (match) return { type: "call", target: match };

    if (lower.startsWith("open ")) return { type: "openApp", name: transcript.slice(5).trim() };

    return { type: "unknown", transcript };
  }

  function urlSchemeForApp(name) {
    return openAppSchemes[(name || "").toLowerCase().trim()] || null;
  }

  function extractAfter(keywords, transcript) {
    const lower = transcript.toLowerCase();
    for (const kw of [...keywords].sort((a, b) => b.length - a.length)) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) {
        const rest = transcript.slice(idx + kw.length).trim();
        if (rest) return rest;
      }
    }
    return null;
  }

  function splitRecipientAndTopic(text) {
    if (!/^to\s/i.test(text)) return { recipient: null, topic: text };
    const afterTo = text.slice(3);
    const aboutMatch = afterTo.match(/\sabout\s/i);
    if (aboutMatch) {
      const recipient = afterTo.slice(0, aboutMatch.index).trim();
      const topic = afterTo.slice(aboutMatch.index + aboutMatch[0].length).trim();
      return { recipient: recipient || null, topic };
    }
    return { recipient: null, topic: text };
  }

  return { route, urlSchemeForApp };
})();

// ---------------------------------------------------------------------

const App = (() => {
  let currentBrief = null;
  let gmailTokens = null;

  function $(id) {
    return document.getElementById(id);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("active", el.id === id));
  }

  // ---------- navigation ----------

  function initNav() {
    $("btn-open-settings").addEventListener("click", () => {
      showScreen("screen-settings");
      loadConnections();
    });
    $("btn-close-settings").addEventListener("click", () => showScreen("screen-brief"));
    $("btn-ask-jarvis").addEventListener("click", () => {
      resetAsk();
      showScreen("screen-ask");
    });
    $("btn-close-ask").addEventListener("click", () => {
      JarvisSpeech.stop();
      JarvisSpeech.stopListening();
      showScreen("screen-brief");
    });
  }

  // ---------- daily brief ----------

  async function loadBrief() {
    const body = $("brief-body");
    try {
      const tokens = gmailTokens || loadStoredGmailTokens();
      const brief = await JarvisAPI.fetchDailyBrief(tokens, null);
      currentBrief = brief;
      renderBrief(brief);
    } catch (err) {
      body.innerHTML = statusViewHTML("error", err.message || "Couldn't load today's brief.", true);
      const retry = body.querySelector(".retry");
      if (retry) retry.addEventListener("click", loadBrief);
    }
  }

  function renderBrief(brief) {
    $("brief-greeting").textContent = (brief.greeting || "").toUpperCase();

    const marketRows = (brief.market.tickers || [])
      .slice(0, 3)
      .map(
        (t) => `<div class="panel-row"><span class="panel-sym">${esc(t.symbol)}</span>
          <span class="panel-change" style="color:${trendColor(t.trend)}">${(t.changePercent >= 0 ? "+" : "") + t.changePercent.toFixed(1)}%</span></div>`
      )
      .join("") || `<div class="panel-empty">No data</div>`;

    const emailItems =
      (brief.emails || [])
        .slice(0, 2)
        .map(
          (e) => `<div class="panel-item"><div class="panel-item-title">${esc(e.subject)}</div><div class="panel-item-sub">${esc(e.from)}</div></div>`
        )
        .join("") || `<div class="panel-empty">None important</div>`;

    const headlineItems =
      (brief.headlines || [])
        .slice(0, 2)
        .map(
          (h) => `<div class="panel-item"><div class="panel-item-title">${esc(h.title)}</div><div class="panel-item-sub">${esc(h.source)}</div></div>`
        )
        .join("") || `<div class="panel-empty">No headlines</div>`;

    const active = (brief.connections || []).filter((c) => c.available).length;
    const statusItems = (brief.connections || [])
      .map(
        (c) =>
          `<div class="panel-item" style="display:flex;align-items:center;"><span class="dot" style="background:${c.available ? "#2FE39B" : "#4F6070"}"></span><span class="panel-item-sub">${esc(c.name)}</span></div>`
      )
      .join("");

    $("brief-body").innerHTML = `
      <div class="brief-row">
        <div class="brief-col">
          <div class="panel"><div class="panel-title">MARKET</div>${marketRows}</div>
          <div class="panel"><div class="panel-title">EMAILS</div>${emailItems}</div>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;">
          <button class="reactor-btn" id="btn-read-brief" aria-label="Read brief aloud"></button>
          <div class="reactor-label" id="read-brief-label">TAP TO READ</div>
        </div>

        <div class="brief-col">
          <div class="panel"><div class="panel-title">HEADLINES</div>${headlineItems}</div>
          <div class="panel"><div class="panel-title">STATUS</div><div class="panel-item-sub" style="margin-bottom:6px;">${active}/${(brief.connections || []).length} LINKED</div>${statusItems}</div>
        </div>
      </div>
    `;

    const reactorHost = $("btn-read-brief");
    mountReactor(reactorHost, 148, JarvisSpeech.isSpeaking);
    reactorHost.addEventListener("click", () => {
      if (JarvisSpeech.isSpeaking) JarvisSpeech.stop();
      else JarvisSpeech.speak(spokenTextForBrief(brief));
    });
    JarvisSpeech.onSpeakingChange((speaking) => {
      if (!document.body.contains(reactorHost)) return;
      reactorHost.classList.toggle("active", speaking);
      $("read-brief-label").textContent = speaking ? "READING…" : "TAP TO READ";
    });
  }

  function spokenTextForBrief(brief) {
    const parts = [brief.greeting + ". Here is your daily brief.", brief.market.advice];
    (brief.market.tickers || [])
      .filter((t) => t.trend !== "neutral")
      .slice(0, 3)
      .forEach((t) => parts.push(t.note));
    if (!brief.emails || brief.emails.length === 0) parts.push("No important emails in the last day.");
    else {
      parts.push(`You have ${brief.emails.length} important email${brief.emails.length === 1 ? "" : "s"}.`);
      brief.emails.slice(0, 3).forEach((e) => parts.push(`From ${e.from}: ${e.subject}.`));
    }
    if (brief.headlines && brief.headlines.length) {
      parts.push("Top headlines:");
      brief.headlines.slice(0, 3).forEach((h) => parts.push(h.title));
    }
    return parts.join(" ");
  }

  function trendColor(trend) {
    return trend === "bullish" ? "#2FE39B" : trend === "bearish" ? "#FF5C5C" : "#7C93A6";
  }

  function statusViewHTML(kind, message, showRetry) {
    const icon =
      kind === "success"
        ? `<svg width="40" height="40" viewBox="0 0 24 24" fill="#2FE39B"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5 5-6" stroke="#020408" stroke-width="1.8" fill="none"/></svg>`
        : `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="1.8"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>`;
    return `<div class="status-view ${kind}">${icon}<p>${esc(message)}</p>${showRetry ? '<button class="retry">Try again</button>' : ""}</div>`;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- settings ----------

  function initSettings() {
    $("input-backend-url").value = Prefs.get("backendUrl");
    $("input-api-key").value = Prefs.get("apiKey");
    $("input-brief-time").value = Prefs.get("briefTime") || "07:00";

    $("input-backend-url").addEventListener("change", (e) => Prefs.set("backendUrl", e.target.value.trim()));
    $("input-api-key").addEventListener("change", (e) => Prefs.set("apiKey", e.target.value.trim()));
    $("input-brief-time").addEventListener("change", (e) => {
      Prefs.set("briefTime", e.target.value);
      scheduleDailyNotification(e.target.value);
    });

    $("toggle-call-alerts").addEventListener("click", () => {
      alert("Not available yet — add Twilio credentials to the backend's .env, then this switches on.");
    });
  }

  async function loadConnections() {
    const list = $("connections-list");
    if (!Prefs.get("backendUrl") || !Prefs.get("apiKey")) {
      list.innerHTML = `<div class="hint" style="padding:12px 14px;">Set your backend URL and API key above first.</div>`;
      return;
    }
    try {
      const connections = await JarvisAPI.fetchConnections();
      list.innerHTML = connections.map(connectionRowHTML).join("");
      const gmailBtn = list.querySelector("[data-connect='gmail']");
      if (gmailBtn) gmailBtn.addEventListener("click", connectGmail);
    } catch (err) {
      list.innerHTML = `<div class="hint" style="padding:12px 14px;">${esc(err.message)}</div>`;
    }
  }

  function connectionRowHTML(c) {
    const connected = c.id === "gmail" ? !!loadStoredGmailTokens() : c.available;
    let statusHTML;
    if (!c.available) statusHTML = `<span class="conn-status unavailable">Unavailable</span>`;
    else if (connected) statusHTML = `<span class="conn-status connected">● Connected</span>`;
    else if (c.id === "gmail") statusHTML = `<button class="conn-connect-btn" data-connect="gmail">Connect</button>`;
    else statusHTML = `<span class="conn-status connected">● Ready</span>`;

    return `<div class="field-row conn-row">
      <div class="conn-top"><label>${esc(c.name)}</label>${statusHTML}</div>
      ${c.reason ? `<div class="conn-reason">${esc(c.reason)}</div>` : ""}
    </div>`;
  }

  function loadStoredGmailTokens() {
    const raw = Prefs.get("gmailTokens");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function connectGmail() {
    try {
      const { url } = await JarvisAPI.gmailAuthUrl();
      if (window.Capacitor && window.Capacitor.Plugins.Browser) {
        await window.Capacitor.Plugins.Browser.open({ url });
      } else {
        window.open(url, "_blank");
      }
    } catch (err) {
      alert("Couldn't start Gmail sign-in: " + err.message);
    }
  }

  function initGmailDeepLink() {
    if (!(window.Capacitor && window.Capacitor.Plugins.App)) return;
    window.Capacitor.Plugins.App.addListener("appUrlOpen", async (data) => {
      const url = new URL(data.url);
      if (url.pathname.includes("gmail/callback") || url.host.includes("gmail")) {
        const code = url.searchParams.get("code");
        if (!code) return;
        if (window.Capacitor.Plugins.Browser) window.Capacitor.Plugins.Browser.close();
        try {
          const tokens = await JarvisAPI.exchangeGmailCode(code);
          Prefs.set("gmailTokens", JSON.stringify(tokens));
          gmailTokens = tokens;
          loadConnections();
        } catch (err) {
          alert("Gmail sign-in failed: " + err.message);
        }
      }
    });
  }

  async function scheduleDailyNotification(timeStr) {
    if (!(window.Capacitor && window.Capacitor.Plugins.LocalNotifications)) return;
    const { LocalNotifications } = window.Capacitor.Plugins;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      $("notif-status").textContent = "Enable notifications in Android settings to get a daily reminder.";
      return;
    }
    const [hour, minute] = timeStr.split(":").map(Number);
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: "Your Jarvis daily brief is ready",
          body: "Tap to see today's emails, market moves, and headlines.",
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        },
      ],
    });
    $("notif-status").textContent = "Daily brief notification scheduled.";
  }

  // ---------- ask jarvis ----------

  let askState = "idle";

  function resetAsk() {
    askState = "idle";
    JarvisSpeech.stop();
    $("ask-content").innerHTML = `
      <div class="ask-hint">Tap the reactor and try:</div>
      <div class="ask-examples">"EMAIL SAM ABOUT FRIDAY"<br>"TEXT SAM RUNNING LATE"<br>"CALL SAM"<br>"OPEN INSTAGRAM"</div>
    `;
    mountReactor($("btn-ask-reactor"), 96, false);
  }

  function initAsk() {
    mountReactor($("btn-ask-reactor"), 96, false);

    $("btn-ask-reactor").addEventListener("click", () => {
      if (askState === "listening") {
        JarvisSpeech.stopListening();
      } else if (askState === "idle") {
        beginListening();
      } else {
        resetAsk();
      }
    });

    JarvisSpeech.onListeningChange((listening) => {
      mountReactor($("btn-ask-reactor"), 96, listening || JarvisSpeech.isSpeaking);
      if (!listening && askState === "listening") {
        const transcript = lastTranscript.trim();
        if (transcript) routeAndHandle(transcript);
        else resetAsk();
      }
    });
    JarvisSpeech.onSpeakingChange((speaking) => {
      mountReactor($("btn-ask-reactor"), 96, speaking || JarvisSpeech.isListening);
    });

    // Subscribed once; beginListening() just resets lastTranscript each run.
    JarvisSpeech.onTranscript((text) => {
      lastTranscript = text;
      const el = $("live-transcript");
      if (el) el.textContent = text;
    });
  }

  let lastTranscript = "";

  function beginListening() {
    lastTranscript = "";
    if (JarvisSpeech.supportsNativeSTT()) {
      askState = "listening";
      $("ask-content").innerHTML = `<div class="ask-transcript" id="live-transcript">Listening…</div>`;
      JarvisSpeech.startListening();
      mountReactor($("btn-ask-reactor"), 96, true);
    } else {
      // Fallback: plain text field. Tap its keyboard's mic button to dictate.
      askState = "typing";
      $("ask-content").innerHTML = `
        <div class="ask-hint">Type or dictate a command:</div>
        <textarea class="dictation-fallback" id="fallback-input" rows="3" placeholder="Email Sam about rescheduling Friday…"></textarea>
        <button class="btn-accent" id="fallback-submit" style="max-width:200px;">Go</button>
      `;
      $("fallback-input").focus();
      $("fallback-submit").addEventListener("click", () => {
        const text = $("fallback-input").value.trim();
        if (text) routeAndHandle(text);
      });
    }
  }

  async function routeAndHandle(transcript) {
    askState = "working";
    $("ask-content").innerHTML = `<div class="spinner-label">Working on it…</div>`;
    const command = CommandRouter.route(transcript);

    switch (command.type) {
      case "composeEmail":
        await handleComposeEmail(command.recipient, command.topic);
        break;
      case "composeText":
        await handleComposeText(command.recipient, command.topic);
        break;
      case "call":
        await handleCall(command.target);
        break;
      case "openApp":
        await handleOpenApp(command.name);
        break;
      default:
        showAskError(
          `I didn't catch a command in "${transcript}". Try "email Sam about rescheduling Friday", "text Sam I'm running late", "call Sam", or "open Instagram".`
        );
    }
  }

  function showAskError(message) {
    askState = "error";
    $("ask-content").innerHTML = statusViewHTML("error", message, false) + `<button class="retry" id="ask-retry">Try again</button>`;
    $("ask-retry").addEventListener("click", resetAsk);
  }

  async function handleComposeEmail(recipient, topic) {
    try {
      const draft = await JarvisAPI.composeEmail(recipient, null, topic);
      askState = "emailDraft";
      $("ask-content").innerHTML = `
        <div class="card">
          ${recipient ? `<div class="card-label">To: ${esc(recipient)}</div>` : ""}
          <div class="card-title">${esc(draft.subject)}</div>
          <div class="card-divider"></div>
          <div class="card-body">${esc(draft.body)}</div>
          <input class="card-input" id="email-recipient-input" placeholder="Recipient email address" type="email" />
          <div class="card-actions">
            <button class="btn-ghost" id="email-read-again">Read again</button>
            <button class="btn-danger" id="email-discard">Discard</button>
            <button class="btn-accent" id="email-send" disabled>Send</button>
          </div>
        </div>
      `;
      JarvisSpeech.speak(`Subject: ${draft.subject}. ${draft.body}`);

      const input = $("email-recipient-input");
      const sendBtn = $("email-send");
      input.addEventListener("input", () => (sendBtn.disabled = !input.value.trim()));
      $("email-read-again").addEventListener("click", () => JarvisSpeech.speak(`Subject: ${draft.subject}. ${draft.body}`));
      $("email-discard").addEventListener("click", resetAsk);
      sendBtn.addEventListener("click", async () => {
        const tokens = loadStoredGmailTokens();
        if (!tokens) return showAskError("Connect Gmail in Settings first — I need send permission to actually send this.");
        try {
          await JarvisAPI.sendEmail(tokens, input.value.trim(), draft.subject, draft.body);
          askState = "emailSent";
          $("ask-content").innerHTML = statusViewHTML("success", "Email sent.", false);
        } catch (err) {
          showAskError("Couldn't send that email: " + err.message);
        }
      });
    } catch (err) {
      showAskError("Couldn't draft that email: " + err.message);
    }
  }

  async function handleComposeText(recipient, topic) {
    if (!recipient) return showAskError('Who should I text? Try "text Sam I\'m running late".');
    try {
      const { body } = await JarvisAPI.composeText(recipient, topic);
      askState = "textDraft";
      $("ask-content").innerHTML = `
        <div class="card">
          <div class="card-label">To: ${esc(recipient)}</div>
          <div class="card-body">${esc(body)}</div>
          <input class="card-input" id="text-number-input" placeholder="Phone number" type="tel" />
          <div class="card-note">You'll tap Send yourself in the Messages app — no app can send texts automatically.</div>
          <div class="card-actions">
            <button class="btn-ghost" id="text-read-again">Read again</button>
            <button class="btn-danger" id="text-discard">Discard</button>
            <button class="btn-accent" id="text-open" disabled>Open Messages</button>
          </div>
        </div>
      `;
      JarvisSpeech.speak(`I've drafted a text to ${recipient}: ${body}. You'll need to tap send yourself.`);
      const input = $("text-number-input");
      const openBtn = $("text-open");
      input.addEventListener("input", () => (openBtn.disabled = !input.value.trim()));
      $("text-read-again").addEventListener("click", () => JarvisSpeech.speak(body));
      $("text-discard").addEventListener("click", resetAsk);
      openBtn.addEventListener("click", () => {
        window.location.href = `sms:${encodeURIComponent(input.value.trim())}?body=${encodeURIComponent(body)}`;
        resetAsk();
      });
    } catch (err) {
      showAskError("Couldn't draft that text: " + err.message);
    }
  }

  async function handleCall(target) {
    askState = "callReady";
    $("ask-content").innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
        <div style="font-size:16px;font-weight:600;">Call ${esc(target)}?</div>
        <input class="card-input" id="call-number-input" placeholder="Phone number" type="tel" style="width:220px;text-align:center;" />
        <div class="card-note">Android will ask you to confirm before dialing — that step can't be skipped.</div>
        <div class="card-actions" style="width:220px;">
          <button class="btn-ghost" id="call-cancel">Cancel</button>
          <button class="btn-accent" id="call-confirm" disabled>Call</button>
        </div>
      </div>
    `;
    const input = $("call-number-input");
    const callBtn = $("call-confirm");
    input.addEventListener("input", () => (callBtn.disabled = !input.value.trim()));
    $("call-cancel").addEventListener("click", resetAsk);
    callBtn.addEventListener("click", () => {
      window.location.href = "tel:" + encodeURIComponent(input.value.trim());
      resetAsk();
    });
  }

  async function handleOpenApp(name) {
    const scheme = CommandRouter.urlSchemeForApp(name);
    if (!scheme) {
      return showAskError(`I don't have a way to open "${name}" — it may not be installed, or doesn't support being opened by another app.`);
    }
    window.location.href = scheme;
    askState = "appOpened";
    $("ask-content").innerHTML = statusViewHTML("success", `Opened ${name}.`, false);
  }

  // ---------- boot ----------

  async function init() {
    await Prefs.hydrate(["backendUrl", "apiKey", "briefTime", "gmailTokens"]);
    initNav();
    initSettings();
    initAsk();
    initGmailDeepLink();
    gmailTokens = loadStoredGmailTokens();
    await loadBrief();
    if (Prefs.get("briefTime")) scheduleDailyNotification(Prefs.get("briefTime"));
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
