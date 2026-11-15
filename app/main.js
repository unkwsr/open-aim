// flyable-option-removed-v1
// Desktop wrapper for the offline open-aim game.
// Serves the site folder on 127.0.0.1:8000 exactly like aim_offline.py and
// opens http://localhost:8000/aim in a window.
const { app, BrowserWindow, Menu, dialog, ipcMain, screen, session, shell } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const backups = require("./backups");
const studio = require("./studio-store");
const communityFeed = require("./community-feed");

// Test copy: when run from source (every Start Test Game launcher), keep player data and backups in
// test-data/ and use port 8137, separate from the real game.
// upgrade-safety-v1 (14 Nov 2026): an installed build never does this. It must use the same data
// folder (%APPDATA%\AimTrainer) and port (8000) as 1.3.0, or players updating from 1.3.0 would open a
// game with no settings, drills or history (their data would still be there, but unread).
const TEST_ROOT = path.join(__dirname, "..");
if (!app.isPackaged) {
  process.env.AIM_PROFILE = path.join(TEST_ROOT, "test-data");
  process.env.AIM_PORT = "8137";
}

// Testing only: AIM_PROFILE=<folder> keeps all player data and backups in that folder,
// so test runs never touch the real save.
if (process.env.AIM_PROFILE) {
  app.setPath("appData", process.env.AIM_PROFILE);
  app.setPath("userData", path.join(process.env.AIM_PROFILE, "AimTrainer"));
} else {
  // The program is called openVaim now, but players' settings, drills and sign-in stay in the
  // AimTrainer folder they already have (Windows would otherwise give the new name an empty folder).
  app.setPath("userData", path.join(app.getPath("appData"), "AimTrainer"));
}

// The game is served on port 8000 (8137 in this test copy). If another program uses it,
// start the app with --port=<number> (add it to the shortcut's Target) or set AIM_PORT.
// Settings and training history are saved per port, and Discord sign-in (Community
// Workshop) only works on 8000 and 8137, the two ports registered with Discord.
// From open-aim PR 9 (marker `port-option-v1`).
const DEFAULT_PORT = 8000;
function pickPort() {
  const arg = process.argv.find((a) => a.startsWith("--port="));
  const ok = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : 0; };
  // A bad --port falls back to AIM_PORT (8137 here), then 8000.
  return ok(arg && arg.slice("--port=".length)) || ok(process.env.AIM_PORT) || DEFAULT_PORT;
}
const PORT = pickPort();
const HOST = "127.0.0.1";
const ORIGIN = `http://localhost:${PORT}`;
const START_PATH = "/aim";
const SELF_NAME = "__self__"; // used when a URL path is both a file and a folder

// folder-rename-v1 (14 Nov 2026): base/ = the original open-aim website files (bottom layer);
// site/ = our own rebuilt game, whose files replace base/ files at the same URL path (e.g. a weapon
// skin in site/aim-viewmodel/). Packaged: resources/base + resources/site. Dev: base/ one folder up,
// app/site/. (Were site/ and app/mods/ before.)
const ROOT = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
const OUT = path.join(ROOT, "base");
const META_FILE = path.join(ROOT, "site_meta.json");
const MODS = app.isPackaged ? path.join(process.resourcesPath, "site") : path.join(__dirname, "site");

// Same extra types aim_offline.py registers, plus the common ones Python's
// mimetypes module knows.
const MIME = {
  ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
  ".ktx2": "image/ktx2", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
  ".webmanifest": "application/manifest+json", ".html": "text/html", ".htm": "text/html",
  ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".xml": "text/xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml",
  ".ico": "image/vnd.microsoft.icon", ".ogg": "audio/ogg", ".mp3": "audio/mpeg",
  ".wav": "audio/x-wav", ".mp4": "video/mp4", ".webm": "video/webm",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".bin": "application/octet-stream",
};


// The site's ad loader pulls live ads from an ad network when online. Requests
// outside the local server are blocked, and the empty ad slots are hidden,
// as are the author's contact credit (top-bar Help popup, in-game corner panel).
const HIDE_CSS = `
  .aim-ad-dock, .aim-ad-label, .aim-result-ad, .al-wk-ad-card, .map-ad-anchor,
  body > iframe.map-ad-unit, body > iframe.aim-ad-direct-banner,
  aside.aim-game-credit, details.contact-credit { display: none !important; }
`;

// Restyled in-game menus (compact cards instead of full-screen text).
const UI_CSS = fs.readFileSync(path.join(__dirname, "ui.css"), "utf-8");
// Esports broadcast look for the whole app (lobby, results, HUD, menus, studio).
const THEME_CSS = fs.readFileSync(path.join(__dirname, "theme-esports.css"), "utf-8");
// Offline only: hides sign-in, leaderboards, cloud sync and the site's play counts.
const OFFLINE_CSS = fs.readFileSync(path.join(__dirname, "offline.css"), "utf-8");
// Moves the lobby sidebar (Quick start, Favorites, Creator, Manual) into the top bar.
const LOBBY_BAR_JS = fs.readFileSync(path.join(__dirname, "lobby-bar.js"), "utf-8");
const FRAME_METER_JS = fs.readFileSync(path.join(__dirname, "frame-meter.js"), "utf-8");
// In-game agent picker (N): Jett or Neon, restarts the round with the pick.
const AGENT_PICKER_JS = fs.readFileSync(path.join(__dirname, "agent-picker.js"), "utf-8");
// Settings › General › Mouse: "2x zoom (toggle scope)" choice (second click or 2x key only).
const SCOPE_ZOOM_SETTING_JS = fs.readFileSync(path.join(__dirname, "scope-zoom-setting.js"), "utf-8");
// Detailed recording wraps every GPU draw and times every tick; enable only for diagnosis.
const FRAME_LOG_ENABLED = process.env.AIM_FRAME_LOG === "1";
const FRAME_LOG_JS = FRAME_LOG_ENABLED ? fs.readFileSync(path.join(__dirname, "frame-log.js"), "utf-8") : "";
// Startup screen over the half-loaded lobby until its training list is in.
const STARTUP_SCREEN_JS = fs.readFileSync(path.join(__dirname, "startup-screen.js"), "utf-8");
// Shared page watcher for the UI scripts below; sleeps while the mouse is locked in a round.
const PAGE_WATCH_JS = fs.readFileSync(path.join(__dirname, "page-watch.js"), "utf-8");
// Keep lobby wheel input native so Chromium can scroll without a JavaScript frame loop.
const VIDEO_SETTINGS_JS = fs.readFileSync(path.join(__dirname, "video-settings.js"), "utf-8");
// Interface: Performance / Enhanced (Settings > Video > Smoothness).
const INTERFACE_MODE_JS = fs.readFileSync(path.join(__dirname, "interface-mode.js"), "utf-8");
const SPOT_MODE_CARDS_JS = fs.readFileSync(path.join(__dirname, "spot-mode-cards.js"), "utf-8");
// Backups and sensitivity panels opened from the top bar.
const SNIPER_SCOPES_JS = fs.readFileSync(path.join(__dirname,"sniper-scopes.js"),"utf-8");
const FAN_AUDIO_JS = fs.readFileSync(path.join(__dirname,"fan-audio.js"),"utf-8");
const ADVANCED_TRACERS_JS = fs.readFileSync(path.join(__dirname, "advanced-tracers.js"), "utf-8");
const LOCAL_CUSTOMIZATION_JS = fs.readFileSync(path.join(__dirname, "local-customization.js"), "utf-8");
// Hit sound: Porphyr or the player's own file; Settings > Audio cards (hit-sound.js).
const HIT_SOUND_JS = fs.readFileSync(path.join(__dirname, "hit-sound.js"), "utf-8");
// Pre-aim aids: Angle marks + Height gauge, drawn from the order overlay (angle-aids.js).
const ANGLE_AIDS_JS = fs.readFileSync(path.join(__dirname, "angle-aids.js"), "utf-8");
// Collection: lobby tab for weapon skins, pre-rendered pictures in site/aim-ui/collection (collection.js).
const COLLECTION_JS = fs.readFileSync(path.join(__dirname, "collection.js"), "utf-8");
// Target Workshop tab, rebuilt (target-workshop.js; the lobby hands it the tab via aim-target-workshop-rebuild).
const TARGET_WORKSHOP_JS = fs.readFileSync(path.join(__dirname, "target-workshop.js"), "utf-8");
// enemy-rank-v1: rank badge + arrows on the lobby drill cards (enemy-rank-cards.js).
const ENEMY_RANK_CARDS_JS = fs.readFileSync(path.join(__dirname, "enemy-rank-cards.js"), "utf-8");
const PLAYER_TOOLS_JS = fs.readFileSync(path.join(__dirname, "player-tools.js"), "utf-8");

// The Studio (studio/ folder, served at /studio/) replaces the site's own scenario editor:
// /aim/studio redirects there. studio-launch.js lets the Studio start a drill in the lobby.
const STUDIO_DIR = path.join(__dirname, "studio");
const STUDIO_PATH = "/studio/";
const STUDIO_LAUNCH_JS = fs.readFileSync(path.join(__dirname, "studio-launch.js"), "utf-8");
const COMMUNITY_WORKSHOP_JS = fs.readFileSync(path.join(__dirname, "community-workshop.js"), "utf-8");
// From release 1.3.0 (14 Nov 2026): VALORANT settings import and the in-app updater (GitHub releases).
const VALORANT_IMPORT_JS = ["valorant-import.js", "valorant-import-ui.js"]
  .map(name => fs.readFileSync(path.join(__dirname, name), "utf-8")).join("\n");
const VALORANT_IMPORT_CSS = fs.readFileSync(path.join(__dirname, "valorant-import.css"), "utf-8");
const RELEASE_UPDATES_JS = fs.readFileSync(path.join(__dirname, "release-updates-ui.js"), "utf-8");
const RELEASE_UPDATES_CSS = fs.readFileSync(path.join(__dirname, "release-updates.css"), "utf-8");

// Shooting error graph (shooting-error.js). The game's frame loop is served with one extra
// call that hands every shot (its total spread and the spray part) to the graph.
const SHOT_GRAPH_JS = fs.readFileSync(path.join(__dirname, "shooting-error.js"), "utf-8");
// App name: "openVaim" in the lobby's top-left and the window title (brand-name.js).
const BRAND_NAME_JS = fs.readFileSync(path.join(__dirname, "brand-name.js"), "utf-8");
// One executeJavaScript call avoids Electron registering a did-stop-loading
// listener for each UI script while the page is still loading.
const UI_SCRIPTS = [
  ["PAGE WATCH", PAGE_WATCH_JS],

  ["SNIPER SCOPES", SNIPER_SCOPES_JS],
  ["FAN AUDIO", FAN_AUDIO_JS],
  ["ADVANCED TRACERS", ADVANCED_TRACERS_JS],
  ["LOCAL CUSTOMIZATION", LOCAL_CUSTOMIZATION_JS],
  ["HIT SOUND", HIT_SOUND_JS],
  ["ANGLE AIDS", ANGLE_AIDS_JS],
  ["PLAYER TOOLS", PLAYER_TOOLS_JS],
  ["INTERFACE MODE", INTERFACE_MODE_JS],
  ["SPOT MODE CARDS", SPOT_MODE_CARDS_JS],
  // Normal gameplay skips recording; the diagnostic launcher sets AIM_FRAME_LOG=1.
  ...(FRAME_LOG_ENABLED ? [["FRAME LOG", FRAME_LOG_JS]] : []),
  ["FRAME METER", FRAME_METER_JS],
  // release-no-dev-tools-v1: the detailed recorder (Ctrl+Shift+P/R/C/L, automatic per-frame logs on disk) is a
  // test tool; installed builds leave it out.
  ...(app.isPackaged ? [] : [["DETAILED PERFORMANCE", "import('/local/performance-meter.mjs').catch(error => console.error('Performance meter:', error));"]]),
  ["VIDEO SETTINGS", VIDEO_SETTINGS_JS],
  ["LOBBY BAR", LOBBY_BAR_JS],
  ["COLLECTION", COLLECTION_JS],
  ["TARGET WORKSHOP", TARGET_WORKSHOP_JS],
  ["ENEMY RANK CARDS", ENEMY_RANK_CARDS_JS],
  ["AGENT PICKER", AGENT_PICKER_JS],
  ["SCOPE ZOOM SETTING", SCOPE_ZOOM_SETTING_JS],
  ["STUDIO LAUNCH", STUDIO_LAUNCH_JS],
  ["COMMUNITY WORKSHOP", COMMUNITY_WORKSHOP_JS],
  ["SHOT GRAPH", SHOT_GRAPH_JS],
  ["RELEASE UPDATES", RELEASE_UPDATES_JS],
  ["VALORANT IMPORT", VALORANT_IMPORT_JS],
  ["BRAND NAME", BRAND_NAME_JS],
];
// The startup screen goes in on its own, straight away (see createWindow).
// Test copy: with the recorder on, each script runs under its own name so the slow-frame
// logs say which one a stall came from. Normal gameplay uses the plain form.
const uiScriptRun = (name, source) => {
  const body = !FRAME_LOG_ENABLED
    ? source
    : `(0, eval)(${JSON.stringify(`${source}\n//# sourceURL=aim-ui/${name.toLowerCase().replace(/ /g, "-")}.js`)});`;
  return `try {\n${body}\n} catch (err) { console.error(${JSON.stringify(name)} + ":", err); }`;
};
const STARTUP_SCREEN_RUN = uiScriptRun("STARTUP SCREEN", STARTUP_SCREEN_JS);
const UI_SCRIPT_BATCH = UI_SCRIPTS.map(([name, source]) => uiScriptRun(name, source)).join("\n");
// The lobby page opened in a normal browser (http://localhost:8137/aim) gets the same look and UI
// scripts as the game window, built into the page, so it shows the red openVaim UI instead of the
// site's own green one. The game window is left alone (it adds these itself, see createWindow);
// it is recognised by "Electron" in its user agent. Desktop-only features still need the game window.
const noCloseTag = (text, tag) => text.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
const BROWSER_HEAD = `<style id="aim-browser-theme">${noCloseTag([HIDE_CSS, UI_CSS, THEME_CSS, OFFLINE_CSS].join("\n"), "style")}</style>`;
const BROWSER_BODY = `<script>${noCloseTag(STARTUP_SCREEN_RUN, "script")}</script><script>${noCloseTag(UI_SCRIPT_BATCH, "script")}</script>`;
function themedForBrowser(html) {
  let out = html.replace(/<\/head>/i, (m) => BROWSER_HEAD + m); // function: no $ patterns
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>(?![\s\S]*<\/body>)/i, (m) => BROWSER_BODY + m) : out + BROWSER_BODY;
  return out;
}
const SHOT_LOOP_FILE = "/next/js/OkAdunfX.js";
const SHOT_LOOP_FROM = 'xe.kind==="shot"&&(Kt.push(xe.tick*ve)';
const SHOT_LOOP_TO = 'xe.kind==="shot"&&(window.__aimShot?.(xe),Kt.push(xe.tick*ve)';

// The runtime translator (dictionary wrapper) was retired in batch 111 (6 Nov 2026): every served screen is direct
// English in code and data; see previews/direct-english/batch-111-translator-retire/README.md.
const ALWAYS_ALLOWED = new Set(["devtools:", "data:", "blob:", "about:", "chrome-extension:", "chrome:"]);

// Extra scenarios (training-set.json, built by tools/make_training_set.py) are added to
// the official training list and their scene files are served like the official ones,
// so they show up in the lobby with results and training history.
const WORKSHOP_LIST = "/prod-api/api/v1/public/val/aimlab/workshop";
const SCENE_PREFIX = "/prod-api/api/v1/public/val/aimlab/scenes/";
const COMMUNITY_ITEMS = "/prod-api/api/v1/public/val/aimlab/pw/items";
// The local workshop service runs separately during development. A deployed
// endpoint can be supplied with AIM_WORKSHOP_API; failure always falls back to
// the library bundled with this test copy.
// An installed game uses the public service; a copy run from source uses the local one.
const WORKSHOP_API_ONLINE = "https://aimtrainer-workshop.aimtw-hub.workers.dev";
const WORKSHOP_API_BASE = (process.env.AIM_WORKSHOP_API ||
  (app.isPackaged ? WORKSHOP_API_ONLINE : "http://127.0.0.1:8138")).replace(/\/$/, "");
const WORKSHOP_READ_TIMEOUT = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::|\/|$)/i.test(WORKSHOP_API_BASE) ? 650 : 5000;
const DISCORD_CLIENT_ID = "1569347030931738865";
// Discord returns to this game's own local server, whichever port it runs on (8000 in
// the release, 8137 in the test copy). Both are registered with the service and Discord.
const WORKSHOP_REDIRECT = `http://127.0.0.1:${PORT}/api/local/workshop/oauth/callback`;
// An upload the moderator is trying out before deciding: listed in VALORANT Training and
// served like a drill of their own until it is decided or the game closes.
let reviewPreview = null;
const WORKSHOP_SESSION_FILE = path.join(app.getPath("userData"), "workshop-session.json");
let oauthPending = null;
// A session is only ever sent to the service that issued it: switching between the
// local and online launchers must not hand one service's token to the other.
function savedWorkshopSession() {
  try {
    const saved = JSON.parse(fs.readFileSync(WORKSHOP_SESSION_FILE, "utf8"));
    return saved && saved.api === WORKSHOP_API_BASE && typeof saved.token === "string" ? saved : null;
  } catch { return null; }
}
function forgetWorkshopSession() {
  try { fs.unlinkSync(WORKSHOP_SESSION_FILE); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
// Errors carry .offline (service not reached) or .status (service answered with an error),
// and always a message that can be shown to the player as is.
async function workshopRequest(route, { method = "GET", body, authorized = false } = {}) {
  const saved = authorized ? savedWorkshopSession() : null;
  if (authorized && !saved?.token) throw new Error("Sign in with Discord first.");
  let response;
  try {
    response = await fetch(WORKSHOP_API_BASE + route, {
      method, signal: AbortSignal.timeout(12000),
      headers: { ...(body ? { "content-type": "application/json" } : {}),
        ...(saved ? { authorization: "Bearer " + saved.token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    const failure = new Error(error?.name === "TimeoutError"
      ? "The workshop service took too long to answer. Try again."
      : "Could not reach the workshop service. Check your connection.");
    failure.offline = true;
    throw failure;
  }
  // An outage page from the host is HTML, not JSON.
  let result = null;
  try { result = await response.json(); } catch {}
  if (!response.ok || !result || typeof result !== "object") {
    const failure = new Error(typeof result?.error === "string" && result.error
      ? result.error : "The workshop service is unavailable. Try again later.");
    failure.status = response.status;
    throw failure;
  }
  return result;
}
function notifyWorkshopAuth(message) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("aim:workshop:auth", message);
}

// The page Discord sign-in returns to in the player's browser: a small dark card in the game's
// style (fixed wording only, nothing from the request is shown). Removes the one-time code from
// the address bar once it has been used.
function signInPage(ok, title, text) {
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>openVaim sign-in</title><style>
html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#0b0d12;color:#d6d9df;font:15px/1.5 "Bahnschrift","Segoe UI",system-ui,sans-serif}
.card{width:min(400px,calc(100% - 40px));box-sizing:border-box;padding:30px 32px 28px;text-align:center;background:#12151c;border:1px solid #262b36;border-top:3px solid ${ok ? "#ff4655" : "#9aa1ae"};border-radius:10px;box-shadow:0 18px 50px #0008}
.mark{display:inline-grid;place-items:center;width:42px;height:42px;margin-bottom:14px;border-radius:50%;background:${ok ? "#ff465522" : "#9aa1ae22"};color:${ok ? "#ff4655" : "#c2c7d0"};font-size:22px;font-weight:800}
h1{margin:0 0 6px;font-size:22px;font-weight:800;color:${ok ? "#ff5a67" : "#ffffff"}}p{margin:0;color:#a7adb9}
.brand{margin-top:18px;font-size:11px;font-weight:700;letter-spacing:.18em;color:#5d6472}
</style><div class="card"><div class="mark">${ok ? "&#10003;" : "!"}</div><h1>${esc(title)}</h1><p>${esc(text)}</p><div class="brand">OPENVAIM</div></div>
<script>history.replaceState(null,"",location.pathname)</script></html>`;
}
async function finishWorkshopLogin(url, res) {
  const pending = oauthPending;
  // Only the request carrying this sign-in's own state may use it up. Anything else that
  // reaches this address (another web page, a stale tab) is answered without touching the
  // sign-in in progress and without a message in the game.
  const given = Buffer.from(String(url.searchParams.get("state") || ""));
  const expected = Buffer.from(pending ? pending.state : "");
  const matches = !!pending && given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (matches) oauthPending = null; // an authorization code can be submitted only once
  const fail = (message) => {
    if (matches) notifyWorkshopAuth({ ok: false, message });
    res.writeHead(400, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    const safe = message.includes("cancelled")
      ? "Sign-in was cancelled. You can close this tab."
      : message.includes("outdated") || message.includes("Not found")
      ? "The workshop service is outdated. Restart it, then try Publish again."
      : message.includes("Discord rejected")
      ? "Discord rejected the sign-in code. Start a new sign-in from openVaim."
      : message.includes("expired") || message.includes("security check")
      ? "This sign-in expired or failed the security check. Start again from openVaim."
      : "The workshop service could not finish sign-in. Check the connection, then try again.";
    res.end(signInPage(false, "Sign-in didn't finish", safe));
  };
  if (!matches || Date.now() - pending.started > 300000) {
    return fail("Discord sign-in expired or the security check failed.");
  }
  if (!url.searchParams.get("code")) {
    return fail(url.searchParams.get("error") ? "Discord sign-in was cancelled." : "Discord sign-in expired or the security check failed.");
  }
  try {
    const result = await workshopRequest("/v1/auth/discord/exchange", { method: "POST",
      body: { code: url.searchParams.get("code"), verifier: pending.verifier, redirectUri: WORKSHOP_REDIRECT } });
    const temp = WORKSHOP_SESSION_FILE + ".tmp";
    fs.mkdirSync(path.dirname(WORKSHOP_SESSION_FILE), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify({ api: WORKSHOP_API_BASE, token: result.token, user: result.user }));
    fs.renameSync(temp, WORKSHOP_SESSION_FILE);
    notifyWorkshopAuth({ ok: true, user: result.user });
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(signInPage(true, "Signed in!", "You can close this tab and return to openVaim."));
  } catch (error) { fail(error.message); }
}
async function workshopRead(route) {
  try {
    const response = await fetch(WORKSHOP_API_BASE + route, { signal: AbortSignal.timeout(WORKSHOP_READ_TIMEOUT) });
    if (!response.ok || Number(response.headers.get("content-length") || 0) > 2_000_000) return null;
    const value = await response.json();
    return value && value.code === "00000" ? value.data : null;
  } catch {
    return null;
  }
}
// The lobby asks for the catalog several times while it opens (home, list, batch). One
// answer, good or failed, is shared for a short while, so an unreachable service costs one
// timeout instead of one per request.
const COMMUNITY_CACHE_MS = 20000;
let communityCache = { at: 0, promise: null };
function approvedCommunityCards() {
  if (communityCache.promise && Date.now() - communityCache.at < COMMUNITY_CACHE_MS) return communityCache.promise;
  const promise = loadCommunityCards().catch((error) => {
    console.log(`COMMUNITY WORKSHOP: ${error && error.message}`);
    return [];
  });
  communityCache = { at: Date.now(), promise };
  return promise;
}
async function loadCommunityCards() {
  const items = [];
  for (let page = 1; page <= 50; page++) {
    const batch = await workshopRead("/v1/workshop?page=" + page);
    if (!Array.isArray(batch)) break;
    items.push(...batch);
    if (batch.length < 100) break;
  }
  // Bundled training scenarios are seeded in the local service for testing,
  // but they are not community uploads and have their own scene source.
  const uploads = items.filter((item) => !trainingSet.scenes[item.shareCode]);
  const entries = await Promise.all(uploads.map(async (item) => ({
    item, scene: item.facts ? null : await workshopRead("/v1/scenes/" + item.shareCode),
  })));
  return communityFeed.catalog(entries);
}
let trainingSet = { items: [], scenes: {} };
// drill-rename-v1: lobby rename only where the scenario sources are (this unpacked copy, never a packed release).
const RENAME_DIR = !app.isPackaged && fs.existsSync(path.join(__dirname, "..", "scenarios")) ? path.join(__dirname, "..", "scenarios") : null;
try {
  trainingSet = JSON.parse(fs.readFileSync(path.join(__dirname, "training-set.json"), "utf-8"));
} catch {}

// creator-lobby-split-v1 (user, 14 Nov 2026): Creator edits no longer change the VALORANT Training drills (the
// studio-autoexport-v1 save hook is gone). To bring Creator changes over on purpose:
// node tools/export-studio-drills.mjs (ONLY=<Creator codes>) then node scripts/build-scenarios.mjs.
// Lobby edits in this unpacked copy (rank pick, rename) are written into scenarios/ and rebuilt one after another.
const lobbyCodeOf = (code) => crypto.createHash("sha256").update(`creator-to-lobby:${code}`).digest("hex").slice(0, 16);
let creatorExports = Promise.resolve();
// drill-names-v1: a player's own names for VALORANT Training drills (lobby card rename in a released game).
const DRILL_NAMES_FILE = () => path.join(app.getPath("userData"), "drill-names.json");
let drillNames = {};
try { drillNames = JSON.parse(fs.readFileSync(DRILL_NAMES_FILE(), "utf-8")) || {}; } catch {}
const drillName = (item) => (item && drillNames[item.shareCode]) || (item && item.name) || "";
function runNodeTool(args, env) {
  return new Promise((resolve, reject) => {
    const child = require("child_process").spawn("node", args, { cwd: path.join(__dirname, ".."), env: { ...process.env, ...env }, windowsHide: true });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error((err || out).trim().slice(-600)))));
  });
}
async function rebuildTrainingSet() {
  await runNodeTool(["scripts/build-scenarios.mjs"]);
  trainingSet = JSON.parse(fs.readFileSync(path.join(__dirname, "training-set.json"), "utf-8"));
}
// The scenarios/ file of a VALORANT Training drill: { file, text, data } or null.
function scenarioFile(code) {
  if (!RENAME_DIR) return null;
  for (const f of fs.readdirSync(RENAME_DIR).filter((f) => f.endsWith(".json"))) {
    const text = fs.readFileSync(path.join(RENAME_DIR, f), "utf-8").replace(/^﻿/, "");
    if (!text.includes(code)) continue;
    try { const data = JSON.parse(text); if (data && data.item && data.item.shareCode === code) return { file: f, text, data }; } catch {}
  }
  return null;
}
// rank-default-v1: in this unpacked copy a rank picked on a VALORANT Training card is written into the drill, so it
// is that drill's rank for every player after a release (not just a pick on this PC). A drill exported from the
// Creator gets it in its Creator drill (every bot's "Shoots back") and is exported again; any other drill gets the
// rank's shooting written into its scenarios/ file. Records: the scene changes, so it starts a new record line.
async function setDefaultRank(code, rank) {
  const hit = scenarioFile(code);
  if (!hit || !hit.data.scene || hit.data.scene.doc === undefined) throw new Error("Scenario file not found.");
  const sc = hit.data.scene, asText = typeof sc.doc === "string";
  const next = enemyRank.applyRank(asText ? JSON.parse(sc.doc) : sc.doc, rank);
  sc.doc = asText ? JSON.stringify(next) : next;
  const indent = (/\n( +|\t)"/.exec(hit.text) || [, ""])[1];
  fs.writeFileSync(path.join(RENAME_DIR, hit.file), JSON.stringify(hit.data, null, indent) + (hit.text.endsWith("\n") ? "\n" : ""));
  await rebuildTrainingSet();
}

const REMOVED_SCRIPTS = new Set([
  "/_assets/r20261021-1/js/account.js",
  "/_assets/r20261021-1/js/performance-access.js",
  "/_assets/r20261021-1/js/performance-diagnostics-ui.mjs",
  "/_assets/r20261021-1/js/diagnostic-delivery.mjs",
]);

// Stylesheets of removed parts (the account / payment panels), served empty.
const REMOVED_STYLES = new Set([
  "/_assets/r20261021-1/css/account.css",
]);

// enemy-rank-v1: the enemy rank picked on each lobby drill card (enemy-rank.js), { shareCode: rank }.
const enemyRank = require("./enemy-rank.js");
// creator-to-lobby-v1: lobby drills made from Creator drills get new agents, guns and crouching on every start.
const drillShuffle = require("./drill-shuffle.js");
const ENEMY_RANK_FILE = path.join(app.getPath("userData"), "enemy-ranks.json");
let enemyRanks = {};
try { enemyRanks = JSON.parse(fs.readFileSync(ENEMY_RANK_FILE, "utf-8")) || {}; } catch {}
function saveEnemyRanks() {
  try { fs.writeFileSync(ENEMY_RANK_FILE, JSON.stringify(enemyRanks)); } catch (err) { console.log(`ENEMY RANK: ${err}`); }
}

// spot-mode: "fixed" or "random" bot spots per drill, picked on the lobby card (spot-mode-cards.js).
const spotMode = require("./spot-mode.js");
const SPOT_MODE_FILE = path.join(app.getPath("userData"), "spot-modes.json");
let spotModes = {};
try { spotModes = JSON.parse(fs.readFileSync(SPOT_MODE_FILE, "utf-8")) || {}; } catch {}
const itemOf = (code) => trainingSet.items.find((i) => i.shareCode === code);

function sendJson(req, res, value) {
  const body = Buffer.from(JSON.stringify(value), "utf-8");
  res.writeHead(200, { "Content-Type": "application/json", "Content-Length": body.length, "Cache-Control": "no-cache" });
  res.end(req.method === "HEAD" ? undefined : body);
}

// Single instance only: a second launch just focuses the first window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Desktop settings the game shows only in its own desktop shell (window.aimDesktop,
// see preload.js): VSync on/off. Chromium reads its switches only at startup, so a
// change is saved here and applied at the next launch (the game offers a restart).
const SHELL_FILE = path.join(app.getPath("userData"), "shell-settings.json");
let shellSettings = { vsync: false };
try {
  shellSettings = { ...shellSettings, ...JSON.parse(fs.readFileSync(SHELL_FILE, "utf-8")) };
} catch {}
const VSYNC = shellSettings.vsync === true;

// Performance: no vsync, discrete GPU, no throttling. Measured on a 240 Hz
// display: vsync off renders at the full refresh rate (240 FPS), while adding
// "disable-frame-rate-limit" drops this Chromium back to a fixed 60 FPS.
// Above the refresh rate, the game's own "Unlimited" frame mode takes over.
if (!VSYNC) app.commandLine.appendSwitch("disable-gpu-vsync");
app.commandLine.appendSwitch("force_high_performance_gpu");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
// Compiled GPU shaders are kept on disk between launches; Chromium's default
// (~6 MB) is too small for all maps, so shaders were evicted and recompiled,
// freezing the first round of a map for 0.3-0.4 s.
app.commandLine.appendSwitch("gpu-disk-cache-size-kb", String(256 * 1024));
app.commandLine.appendSwitch("gpu-program-cache-size-kb", String(128 * 1024));
// Keep the UI animations even when Windows "Animation effects" is off: the game hides
// its end-of-round verdict splash with an animation, and the theme's motion needs it.
app.commandLine.appendSwitch("force-prefers-no-reduced-motion");

let meta = {};
let mainWindow = null;

// path-guard-v1 (14 Nov 2026): Windows also splits paths on "\" and accepts "C:" drive parts, so a
// request like "/%5C..%5C..%5CWindows%5Cwin.ini" used to reach any file on the PC. Split on both
// separators, drop drive-like parts, and refuse any result that is not inside the site folder.
// safeJoin returns a path inside root, or null. Used by every route that maps a URL to a file.
function safeJoin(root, urlPath, fallback = "index.html") {
  const base = path.resolve(root);
  let p = String(urlPath);
  if (p.includes("\0")) return null;
  if (p.endsWith("/") || p.endsWith("\\")) p += fallback;
  const parts = p.split(/[\\/]+/).filter((x) => x !== "" && x !== "." && x !== ".." && !x.includes(":"));
  if (!parts.length && !fallback) return null;
  const full = path.resolve(base, ...(parts.length ? parts : [fallback]));
  return full.startsWith(base + path.sep) ? full : null;
}
const MISSING_FILE = path.join(OUT, "\0missing"); // isFile() is false for it, so the request gets a 404
function diskPath(urlPath) {
  return safeJoin(OUT, decode(urlPath)) || MISSING_FILE;
}

function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function resolve(reqUrl) {
  const urlPath = decode(new URL(reqUrl, ORIGIN).pathname);
  const p = diskPath(urlPath);
  if (isDir(p)) {
    for (const name of [SELF_NAME, "index.html"]) {
      if (isFile(path.join(p, name))) return [urlPath, path.join(p, name)];
    }
    return [urlPath, null];
  }
  return [urlPath, isFile(p) ? p : null];
}

async function handle(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    // Online features (scores, accounts) don't exist offline.
    res.writeHead(404).end();
    return;
  }
  // Only this machine's own addresses. A web page that points another host name at
  // 127.0.0.1 (DNS rebinding) could otherwise read the player's drills through this server.
  const host = String(req.headers.host || "").toLowerCase();
  if (host !== `localhost:${PORT}` && host !== `${HOST}:${PORT}`) {
    res.writeHead(403).end();
    return;
  }
  const url = new URL(req.url, ORIGIN);
  const requested = decode(url.pathname);
  if (/^\/prod-api\/api\/v1\/public\/val\/aimlab\/pw\/covers\/default-arena(?:-s)?\.jpg$/.test(requested)) {
    res.writeHead(302, { Location: "/local/training-range-thumb.png" }).end();
    return;
  }
  if (requested === "/api/local/workshop/oauth/callback") {
    await finishWorkshopLogin(url, res);
    return;
  }

  // Polls are an online lobby feature; the offline game has no active polls.
  if (requested === "/prod-api/api/v1/public/val/aimlab/polls") {
    sendJson(req, res, { code: "00000", data: { running: [], ended: [] }, msg: "", local: true });
    return;
  }
  // Offline only: no leaderboards (the captured rankings were other players' online
  // scores) and no account; local history is kept by the game in its own storage.
  if (requested.startsWith("/api/local/ranking")) {
    sendJson(req, res, { success: true, mapId: url.searchParams.get("mapId") || "", mode: url.searchParams.get("mode") || "desc", window: "ALL", since: 0, ranking: [] });
    return;
  }
  // The site's lag-report tool ("Performance check" button and its panel) is replaced
  // by the FPS meter in lobby-bar.js; its scripts are served empty.
  if (REMOVED_STYLES.has(requested)) {
    res.writeHead(200, { "Content-Type": "text/css", "Content-Length": 0, "Cache-Control": "no-cache" });
    res.end();
    return;
  }
  if (REMOVED_SCRIPTS.has(requested)) {
    res.writeHead(200, { "Content-Type": "text/javascript", "Content-Length": 0, "Cache-Control": "no-cache" });
    res.end();
    return;
  }
  if (requested === "/api/local/account") {
    sendJson(req, res, { success: true, user: null, scoreSync: null });
    return;
  }
  // The site's scenario editor is replaced by the Studio.
  if (requested === "/aim/studio" || requested.startsWith("/aim/studio/")) {
    res.writeHead(302, { Location: STUDIO_PATH }).end();
    return;
  }
  if (requested === "/studio") {
    res.writeHead(302, { Location: STUDIO_PATH }).end();
    return;
  }
  if (requested.startsWith(STUDIO_PATH)) {
    const file = safeJoin(STUDIO_DIR, requested.slice(STUDIO_PATH.length) || "/"); // path-guard-v1
    if (!file || !isFile(file)) {
      res.writeHead(404).end();
      return;
    }
    const body = fs.readFileSync(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": body.length, "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  // The training list also carries the player's Studio drills (studio-store.js), newest first,
  // and while you record a copycat's run, the recording scene.
  const rec = studio.recording();
  const mine = [reviewPreview, rec, ...studio.all()].filter(Boolean);
  // Community pictures from the workshop service: a cover the moderator set
  // (/pw/covers/<code>-<version>[-s].jpg, the address the page builds from coverCode)
  // and a creator's Discord picture (/api/local/workshop/avatar/<code>).
  const picture = /^\/prod-api\/api\/v1\/public\/val\/aimlab\/pw\/covers\/([a-f0-9]{16})-(\d{1,16})(?:-s)?\.jpg$/.exec(requested) ||
    /^\/api\/local\/workshop\/(avatar)\/([a-f0-9]{16})$/.exec(requested);
  if (picture) {
    const isAvatar = picture[1] === "avatar";
    const found = await workshopPicture(isAvatar ? picture[2] : picture[1], isAvatar ? "avatar" : "cover", isAvatar ? "" : picture[2]);
    if (!found) { res.writeHead(404, { "Cache-Control": "no-cache" }).end(); return; }
    res.writeHead(200, { "Content-Type": found.type, "Content-Length": found.bytes.length, "Cache-Control": isAvatar ? "max-age=600" : "max-age=86400" });
    res.end(found.bytes);
    return;
  }
  if (requested === COMMUNITY_ITEMS || requested === COMMUNITY_ITEMS + "/home" ||
      requested.startsWith(COMMUNITY_ITEMS + "/")) {
    const cards = await approvedCommunityCards();
    let payload;
    if (requested === COMMUNITY_ITEMS + "/home") payload = communityFeed.home(cards);
    else if (requested === COMMUNITY_ITEMS) payload = communityFeed.page(cards, url.searchParams);
    else if (requested.startsWith(COMMUNITY_ITEMS + "/batch/")) {
      const codes = new Set(requested.slice((COMMUNITY_ITEMS + "/batch/").length).split(","));
      payload = communityFeed.OK(cards.filter((card) => codes.has(card.code)));
    } else payload = communityFeed.OK(cards.find((card) => card.code === requested.slice(COMMUNITY_ITEMS.length + 1)) || null);
    sendJson(req, res, payload);
    return;
  }
  if (requested === WORKSHOP_LIST) {
    const [, listFile] = resolve(requested);
    try {
      const list = JSON.parse(fs.readFileSync(listFile, "utf-8"));
      // creator-own-hidden-v1: a Creator drill that has a shuffled lobby version (tools/export-studio-drills.mjs,
      // code = sha256("creator-to-lobby:" + its code)) is left out here, so the main page only shows the shuffled one.
      // It still opens from the Creator (Play) and by its own code.
      const exported = (code) => !!trainingSet.scenes[crypto.createHash("sha256").update(`creator-to-lobby:${code}`).digest("hex").slice(0, 16)];
      const seen = new Set();
      // lobby-hidden-v1: Creator drills listed in <userData>/lobby-hidden.json stay off the main page (still in the Creator).
      let hidden = [];
      try { hidden = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "lobby-hidden.json"), "utf-8")); } catch {}
      const hide = new Set(Array.isArray(hidden) ? hidden : []);
      list.data = [...mine.map((e) => e.item).filter((item) => !(item && item.shareCode && (exported(item.shareCode) || hide.has(item.shareCode)))), ...list.data, ...trainingSet.items.map((i) => (drillNames[i.shareCode] ? { ...i, name: drillNames[i.shareCode] } : i))]
        .filter((item) => item && item.shareCode && !seen.has(item.shareCode) && seen.add(item.shareCode));
      sendJson(req, res, list);
      return;
    } catch {}
  }
  // drill-rename-v1: rename a VALORANT Training drill from its lobby card. In this unpacked copy (scenarios/ next to
  // app/) it writes scenarios/<file>.json, i.e. the name the release ships. Everywhere else (players' games) the
  // name is the player's own: <userData>/drill-names.json (drill-names-v1). The Creator drill is not touched.
  if (requested === "/api/local/drill-rename") {
    const code = url.searchParams.get("code") || "";
    const name = (url.searchParams.get("name") || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (req.headers["x-aim-local"] !== "1" || !/^[a-f0-9]{16}$/.test(code) || !name) { res.writeHead(400).end(); return; }
    const item = trainingSet.items.find((i) => i.shareCode === code);
    if (!item) { sendJson(req, res, { error: "This drill can't be renamed here." }); return; }
    if (trainingSet.items.some((i) => i.shareCode !== code && drillName(i).toLowerCase() === name.toLowerCase())) { sendJson(req, res, { error: "Another drill already has that name." }); return; }
    if (!RENAME_DIR) {
      if (name === item.name) delete drillNames[code]; else drillNames[code] = name;
      try { fs.writeFileSync(DRILL_NAMES_FILE(), JSON.stringify(drillNames)); } catch (err) { sendJson(req, res, { error: "Could not save: " + err.message }); return; }
      sendJson(req, res, { name });
      return;
    }
    try {
      let file = null, data = null, text = "";
      for (const f of fs.readdirSync(RENAME_DIR).filter((f) => f.endsWith(".json"))) {
        text = fs.readFileSync(path.join(RENAME_DIR, f), "utf-8").replace(/^﻿/, "");
        if (!text.includes(code)) continue;
        const d = JSON.parse(text);
        if (d && d.item && d.item.shareCode === code) { file = f; data = d; break; }
      }
      if (!data) { sendJson(req, res, { error: "Scenario file not found." }); return; }
      const indent = (/\n( +|\t)"/.exec(text) || [, ""])[1];
      data.item.name = name;
      if (data.scene) data.scene.name = name;
      fs.writeFileSync(path.join(RENAME_DIR, file), JSON.stringify(data, null, indent) + (text.endsWith("\n") ? "\n" : ""));
      item.name = name;
      if (trainingSet.scenes[code]) trainingSet.scenes[code].name = name;
      sendJson(req, res, { name, file });
    } catch (err) {
      sendJson(req, res, { error: "Could not save: " + err.message });
    }
    return;
  }
  // spot-mode: lobby cards ask which drills can switch bot spots (?codes=a,b,...) and save a pick
  // (?code=..&set=fixed|random, only with the X-Aim-Local header so another page can't change it).
  if (requested === "/api/local/spot-mode") {
    const set = url.searchParams.get("set"), code = url.searchParams.get("code") || "";
    if (set !== null) {
      const item = itemOf(code), scene = trainingSet.scenes[code];
      if (req.headers["x-aim-local"] !== "1" || (set !== "fixed" && set !== "random") || !item || !spotMode.info(scene, item).eligible) { res.writeHead(400).end(); return; }
      spotModes[code] = set;
      try { fs.writeFileSync(SPOT_MODE_FILE, JSON.stringify(spotModes)); } catch (err) { console.log(`SPOT MODE: ${err}`); }
      sendJson(req, res, { [code]: spotMode.info(scene, item, set) });
      return;
    }
    const out = {};
    for (const c of (url.searchParams.get("codes") || "").split(",").slice(0, 300)) {
      if (!/^[a-z0-9-]{1,64}$/i.test(c)) continue;
      const item = itemOf(c);
      out[c] = item ? spotMode.info(trainingSet.scenes[c], item, spotModes[c]) : { eligible: false };
    }
    sendJson(req, res, { cards: out });
    return;
  }
  // enemy-rank-v1: lobby cards ask which drills can have an enemy rank (?codes=a,b,...) and save a pick
  // (?code=..&set=<rank>, only with the X-Aim-Local header so another page can't change it).
  if (requested === "/api/local/enemy-rank") {
    const local = (code) => {
      const own = mine.find((e) => e.item.shareCode === code);
      if (own) return own.scene;
      if (trainingSet.scenes[code]) return trainingSet.scenes[code];
      const file = /^[a-z0-9-]{1,64}$/i.test(code) && resolve(SCENE_PREFIX + code)[1];
      if (!file) return null;
      try { const j = JSON.parse(fs.readFileSync(file, "utf-8")); return j && j.data ? j.data : j; } catch { return null; }
    };
    const set = url.searchParams.get("set"), code = url.searchParams.get("code") || "";
    if (set !== null) {
      if (req.headers["x-aim-local"] !== "1" || !enemyRank.isRank(set) || !/^[a-z0-9-]{1,64}$/i.test(code)) { res.writeHead(400).end(); return; }
      let scene = local(code);
      if (RENAME_DIR && trainingSet.scenes[code] && scene && enemyRank.info(scene).eligible) {
        try {
          if (enemyRank.info(scene).made !== set) {
            const job = creatorExports.then(() => setDefaultRank(code, set));
            creatorExports = job.catch(() => {});
            await job;
          }
          delete enemyRanks[code];
          saveEnemyRanks();
          scene = local(code);
          const info = enemyRank.info(scene);
          sendJson(req, res, { [code]: { ...info, isNew: !!scene.aimShuffle, renamable: true, saved: info.made === set } });
        } catch (err) {
          sendJson(req, res, { error: "Rank not saved: " + err.message });
        }
        return;
      }
      const made = scene ? enemyRank.info(scene).made : null;
      if (made && set === made) delete enemyRanks[code]; else enemyRanks[code] = set;
      saveEnemyRanks();
      sendJson(req, res, { [code]: scene ? enemyRank.info(scene, enemyRanks[code]) : { eligible: true, rank: set } });
      return;
    }
    const out = {};
    for (const c of (url.searchParams.get("codes") || "").split(",").slice(0, 200)) {
      if (!/^[a-z0-9-]{1,64}$/i.test(c)) continue;
      const scene = local(c);
      out[c] = scene ? enemyRank.info(scene, enemyRanks[c]) : { eligible: false };
      // new-drill-tag-v1: the drills exported from the Creator (they carry aimShuffle) get a NEW tag on their card.
      if (scene && scene.aimShuffle && trainingSet.scenes[c]) out[c].isNew = true;
      if (trainingSet.scenes[c]) out[c].renamable = true;
      // heal-text-v1: the first rank that refills HP on a kill (enemy-rank.js rankRules), for the card text.
      if (scene && out[c].eligible) out[c].healFrom = enemyRank.healFrom(scene, (trainingSet.items.find((i) => i.shareCode === c) || mine.find((e) => e.item.shareCode === c)?.item || {}).type);
    }
    sendJson(req, res, { canRename: true, ranks: enemyRank.RANKS.map(([id, name, r, color]) => ({ id, name, color, reaction: r ? r.reaction : null, heads: r ? r.heads : false })), cards: out });
    return;
  }
  if (requested.startsWith(SCENE_PREFIX)) {
    const code = requested.slice(SCENE_PREFIX.length);
    const own = mine.find((e) => e.item.shareCode === code);
    const bundled = trainingSet.scenes[code];
    // The game's own scenes have the same 16-character codes and are files in this copy:
    // they are served from disk below, never asked of (or replaced by) the online service.
    const shipped = !own && !bundled && resolve(requested)[1];
    const online = !own && !bundled && !shipped && /^[a-f0-9]{16}$/i.test(code) ? await workshopRead("/v1/scenes/" + code) : null;
    let scene = own ? own.scene : bundled || online;
    if (bundled && drillNames[code]) scene = { ...scene, name: drillNames[code] }; // drill-names-v1
    if (scene) {
      sendJson(req, res, { code: "00000", data: enemyRank.sceneWithRank(drillShuffle.shuffleScene(bundled ? spotMode.apply(scene, itemOf(code), spotModes[code], trainingSet) : scene, Math.random, code),enemyRanks[code], enemyRank.isHoldSite(scene, (trainingSet.items.find((i) => i.shareCode === code) || own?.item || {}).type)), msg: "", local: true });
      return;
    }
    // enemy-rank-v1: a shipped scene file with a picked rank is sent with the rank applied.
    if (shipped) { // rank-rules-v1: the rank's rules apply to the game's own drills too, picked or not
      try {
        const j = JSON.parse(fs.readFileSync(shipped, "utf-8"));
        if (j && j.data) { sendJson(req, res, { ...j, data: enemyRank.sceneWithRank(j.data, enemyRanks[code]) }); return; }
      } catch {}
    }
  }
  if (requested.endsWith(SHOT_LOOP_FILE)) {
    const override = safeJoin(MODS, requested, ""); // path-guard-v1
    const file = override && isFile(override) ? override : resolve(requested)[1];
    if (file) {
      const source = fs.readFileSync(file, "utf-8");
      if (!source.includes(SHOT_LOOP_FROM)) console.log("SHOT GRAPH: frame loop changed, graph gets no shots");
      const body = Buffer.from(source.replace(SHOT_LOOP_FROM, SHOT_LOOP_TO), "utf-8");
      res.writeHead(200, { "Content-Type": "text/javascript", "Content-Length": body.length, "Cache-Control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
  }
  const mod = safeJoin(MODS, requested, ""); // path-guard-v1
  if (mod && isFile(mod)) {
    const body = fs.readFileSync(mod);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(mod).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  const [urlPath, file] = resolve(req.url);
  if (file === null) {
    if (urlPath === "/" || urlPath === "/index.html") {
      res.writeHead(302, { Location: START_PATH }).end();
      return;
    }
    console.log(`MISSING: ${urlPath}`);
    res.writeHead(404, { "Content-Type": "text/html" }).end("<h1>404 Not Found</h1>");
    return;
  }
  const info = meta[urlPath] || {};
  let mime = info.mime || MIME[path.extname(file).toLowerCase()];
  if (!mime) mime = path.basename(urlPath).includes(".") ? "application/octet-stream" : "text/html";
  let data = fs.readFileSync(file);
  if (/^\/aim\/?$/.test(urlPath) && mime.startsWith("text/html") && !/Electron\//.test(req.headers["user-agent"] || "")) {
    data = Buffer.from(themedForBrowser(data.toString("utf-8")), "utf-8");
  }
  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": data.length,
    "Cache-Control": "no-cache",
    ...(info.headers || {}),
  });
  res.end(req.method === "HEAD" ? undefined : data);
}

function startServer() {
  return new Promise((resolveStart, rejectStart) => {
    const server = http.createServer(handle);
    server.once("error", rejectStart);
    server.listen(PORT, HOST, () => resolveStart(server));
  });
}

function isLocal(url) {
  try {
    const u = new URL(url);
    return (u.hostname === "localhost" || u.hostname === HOST) && Number(u.port) === PORT;
  } catch {
    return false;
  }
}

function createWindow(url) {
  const win = new BrowserWindow({
    show: false,
    backgroundColor: "#0f1923",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { backgroundThrottling: false, preload: path.join(__dirname, "preload.js") },
  });
  win.maximize();
  // Game pages: show the window once the theme and startup screen are in, so the
  // half-loaded lobby never flashes first. The fallback keeps it from staying hidden.
  let shown = false;
  const show = () => {
    if (!shown && !win.isDestroyed()) { shown = true; win.show(); }
  };
  win.once("ready-to-show", () => setTimeout(show, new URL(url).pathname.startsWith(STUDIO_PATH) ? 0 : 3000));
  win.webContents.on("dom-ready", () => {
    // The Studio is a page of its own with its own look; it gets only the loading screen (creator-loading-v1).
    const pagePath = new URL(win.webContents.getURL()).pathname;
    if (pagePath.startsWith(STUDIO_PATH)) {
      win.webContents.mainFrame.executeJavaScript(STARTUP_SCREEN_RUN).catch((err) => console.log(`STARTUP SCREEN: ${err}`)).finally(show);
      return;
    }
    // webContents.executeJavaScript waits until the whole page has stopped loading (every
    // image and late module), seconds after this. The startup screen is run on the main
    // frame instead, which runs now, so the window opens on it rather than a blank page.
    Promise.all([
      win.webContents.insertCSS(HIDE_CSS),
      win.webContents.insertCSS(UI_CSS),
      win.webContents.insertCSS(THEME_CSS),
      win.webContents.insertCSS(OFFLINE_CSS),
      win.webContents.insertCSS(VALORANT_IMPORT_CSS),
      win.webContents.insertCSS(RELEASE_UPDATES_CSS),
      win.webContents.mainFrame.executeJavaScript(STARTUP_SCREEN_RUN).catch((err) => console.log(`STARTUP SCREEN: ${err}`)),
    ]).catch(() => {}).finally(show);
    win.webContents.executeJavaScript(UI_SCRIPT_BATCH).catch((err) => console.log(`UI SCRIPTS: ${err}`));
  });

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === "F12") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Game pages (e.g. the studio opening in a new tab) replace the current page
  // in this window; everything else goes to the normal browser.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isLocal(target)) {
      // creator-loading-v1: opening the Creator shows its loading cover first, so the jump isn't flat.
      const creator = /^\/(studio(\/|$)|aim\/studio(\/|$))/.test(new URL(target).pathname);
      if (creator) {
        // Resolves once the cover is drawn (startup-screen.js); at most 600 ms either way.
        Promise.race([win.webContents.executeJavaScript("window.__aimLoadingCover ? window.__aimLoadingCover() : 0"), new Promise((r) => setTimeout(r, 600))])
          .catch(() => {}).finally(() => { if (!win.isDestroyed()) win.loadURL(target); });
      } else setImmediate(() => win.loadURL(target));
    } else if (/^https?:/i.test(target)) {
      shell.openExternal(target);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, target) => {
    if (!isLocal(target)) {
      event.preventDefault();
      if (/^https?:/i.test(target)) shell.openExternal(target);
    }
  });

  win.loadURL(url);
  return win;
}

// Game fullscreen requests (from preload.js) become window fullscreen; F11 leaves it.
ipcMain.on("aim:fullscreen", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isFullScreen()) win.setFullScreen(true);
});

// Desktop shell info for window.aimDesktop (preload.js): VSync state and the
// refresh rate of each display, which the game's frame settings show.
ipcMain.on("aim:shell:info", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const current = win ? screen.getDisplayMatching(win.getBounds()) : screen.getPrimaryDisplay();
  const primary = screen.getPrimaryDisplay();
  event.returnValue = {
    version: app.getVersion(),
    vsync: VSYNC,
    vsyncSaved: shellSettings.vsync === true,
    displays: screen.getAllDisplays().map((d) => ({
      hz: Math.round(d.displayFrequency) || null,
      current: d.id === current.id,
      primary: d.id === primary.id,
    })),
  };
});
ipcMain.on("aim:shell:vsync", (_event, on) => {
  shellSettings.vsync = on === true;
  try {
    fs.writeFileSync(SHELL_FILE, JSON.stringify(shellSettings, null, 2));
  } catch (err) {
    console.log(`SHELL SETTINGS: ${err}`);
  }
});
// Slow-frame reports from frame-log.js, one file per round.
// upgrade-safety-v1: an installed build has no test profile; its diagnostic files go under the player's
// data folder (path.join(undefined, ...) would stop the game at startup).
const DIAGNOSTICS_ROOT = process.env.AIM_PROFILE || path.join(app.getPath("userData"), "diagnostics");
const FRAME_LOG_DIR = path.join(DIAGNOSTICS_ROOT, "frame-logs");
require("./preparation-error-log.cjs").registerPreparationErrorLog({
  ipcMain, root: path.join(DIAGNOSTICS_ROOT, "preparation-errors"), isLocal,
});
require("./performance-recorder.cjs").registerPerformanceRecorder({
  ipcMain, app, screen, root: app.isPackaged ? path.join(DIAGNOSTICS_ROOT, "performance-runs") : path.join(TEST_ROOT, "test-data", "performance-runs"), vsync: () => VSYNC,
});
ipcMain.on("aim:frame-log", (_event, report) => {
  try {
    fs.mkdirSync(FRAME_LOG_DIR, { recursive: true });
    // The name comes from the page: keep it a plain file name inside the log folder.
    const name = String(report?.startedAt || new Date().toISOString()).replace(/[^0-9A-Za-z_-]/g, "-").slice(0, 80);
    fs.writeFileSync(path.join(FRAME_LOG_DIR, `${name}.json`), JSON.stringify(report, null, 1));
  } catch (err) {
    console.log(`FRAME LOG: ${err}`);
  }
});
// The portable build runs from a temporary copy, so relaunch the .exe itself. Settings
// saved in the page's localStorage just before (map culling) are flushed first, since
// app.exit skips Chromium's normal shutdown.
ipcMain.on("aim:shell:restart", () => {
  const exe = process.env.PORTABLE_EXECUTABLE_FILE;
  session.defaultSession.flushStorageData();
  app.relaunch(exe ? { execPath: exe } : undefined);
  app.exit(0);
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

// Player data backups (backups.js): restore a scheduled backup, then back up, before the window opens.
backups.register(ipcMain, () => mainWindow);
// VALORANT import (from 1.3.0): file picker for the settings files; VSync is saved like the shell's own setting.
require("./valorant-import-ipc").register(() => mainWindow, on => {
  shellSettings.vsync = on === true;
  fs.writeFileSync(SHELL_FILE, JSON.stringify(shellSettings, null, 2));
});
studio.register(ipcMain);
ipcMain.handle("aim:workshop:login", async () => {
  const health = await workshopRequest("/v1/health");
  if (health.mode !== "auth-gated") {
    throw new Error("The workshop service is outdated. Restart or redeploy it first.");
  }
  const state = crypto.randomBytes(24).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  oauthPending = { state, verifier, started: Date.now() };
  const url = new URL("https://discord.com/oauth2/authorize");
  for (const [key, value] of Object.entries({
    response_type: "code", client_id: DISCORD_CLIENT_ID, scope: "identify",
    redirect_uri: WORKSHOP_REDIRECT, state, code_challenge: challenge, code_challenge_method: "S256",
  })) url.searchParams.set(key, value);
  await shell.openExternal(url.toString());
  return { opened: true };
});
ipcMain.handle("aim:workshop:status", async () => {
  try { return await workshopRequest("/v1/me", { authorized: true }); }
  catch (error) {
    // Expired or refused: the saved session is useless, remove it.
    if (error.status === 401) { try { forgetWorkshopSession(); } catch {} return { user: null }; }
    // Service not reached: still signed in on this machine, so Sign out stays available
    // and Publish reports the connection instead of opening Discord again.
    const saved = savedWorkshopSession();
    return saved?.user ? { user: saved.user, offline: true } : { user: null };
  }
});
ipcMain.handle("aim:workshop:logout", () => {
  oauthPending = null;
  forgetWorkshopSession();
  return { user: null };
});
// Hit sound: the player's own file. Copied into the profile so moving the original doesn't break it.
const HIT_SOUND_DIR = path.join(app.getPath("userData"), "custom-sounds");
const HIT_SOUND_META = path.join(HIT_SOUND_DIR, "hit.json");
const HIT_SOUND_TYPES = { ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
ipcMain.handle("aim:hitsound:pick", async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender) || undefined;
  const picked = await dialog.showOpenDialog(owner, { title: "Choose a hit sound", properties: ["openFile"],
    filters: [{ name: "Sound files", extensions: ["ogg", "mp3", "wav"] }] });
  if (picked.canceled || !picked.filePaths[0]) return { canceled: true };
  const source = picked.filePaths[0], ext = path.extname(source).toLowerCase();
  if (!HIT_SOUND_TYPES[ext]) return { error: "Use an .ogg, .mp3 or .wav file" };
  const size = fs.statSync(source).size;
  if (size === 0) return { error: "That file is empty" };
  if (size > 1024 * 1024) return { error: "That file is " + (size / 1048576).toFixed(1) + " MB; the limit is 1 MB" };
  fs.mkdirSync(HIT_SOUND_DIR, { recursive: true });
  for (const old of fs.readdirSync(HIT_SOUND_DIR)) if (/^hit\.(ogg|mp3|wav)$/.test(old)) fs.rmSync(path.join(HIT_SOUND_DIR, old), { force: true });
  fs.copyFileSync(source, path.join(HIT_SOUND_DIR, "hit" + ext));
  fs.writeFileSync(HIT_SOUND_META, JSON.stringify({ name: path.basename(source), file: "hit" + ext }));
  return { name: path.basename(source) };
});
ipcMain.handle("aim:hitsound:read", () => {
  try {
    const meta = JSON.parse(fs.readFileSync(HIT_SOUND_META, "utf-8"));
    if (!/^hit\.(ogg|mp3|wav)$/.test(meta.file || "")) return null;
    const bytes = fs.readFileSync(path.join(HIT_SOUND_DIR, meta.file));
    if (bytes.length === 0 || bytes.length > 1024 * 1024) return null;
    return { name: String(meta.name || meta.file).slice(0, 120), data: bytes.toString("base64") };
  } catch { return null; }
});
// The player's Discord picture. The game window may not load web images (every
// non-local request is blocked), so the picture is fetched here and handed over
// as a small data URL. One picture is kept for the session.
let workshopAvatarCache = null;
ipcMain.handle("aim:workshop:avatar", async () => {
  const user = savedWorkshopSession()?.user;
  if (!user || !/^\d{16,22}$/.test(user.id || "") || !/^[a-z0-9_]{1,40}$/i.test(user.avatar || "")) return { data: null };
  const key = user.id + "/" + user.avatar;
  if (workshopAvatarCache?.key === key) return { data: workshopAvatarCache.data };
  try {
    const response = await fetch(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`,
      { signal: AbortSignal.timeout(10000) });
    if (!response.ok || !(response.headers.get("content-type") || "").startsWith("image/")) return { data: null };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 300000) return { data: null };
    workshopAvatarCache = { key, data: "data:image/png;base64," + bytes.toString("base64") };
    return { data: workshopAvatarCache.data };
  } catch { return { data: null }; }
});
// Pictures (covers, creator avatars) fetched from the workshop service and kept for a while;
// a missing picture is remembered too, so a card without one costs one request.
const workshopPictures = new Map();
async function workshopPicture(code, kind, version) {
  const key = kind + ":" + code + ":" + version;
  const kept = workshopPictures.get(key);
  if (kept && Date.now() - kept.at < (kind === "avatar" ? 600000 : 86400000)) return kept.value;
  let value = null;
  try {
    const response = await fetch(WORKSHOP_API_BASE + "/v1/workshop/" + code + "/" + kind, { signal: AbortSignal.timeout(8000) });
    const type = response.headers.get("content-type") || "";
    if (response.ok && /^image\/(png|jpeg|webp|gif)$/.test(type)) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 0 && bytes.length <= 300000) value = { type, bytes };
    }
  } catch { return null; } // not reached: try again next time
  if (workshopPictures.size > 300) workshopPictures.clear();
  workshopPictures.set(key, { at: Date.now(), value });
  return value;
}
// Like count and whether the signed-in player liked this drill.
ipcMain.handle("aim:workshop:likeState", (_event, code) => {
  if (!/^[a-f0-9]{16}$/i.test(String(code || ""))) throw new Error("Invalid drill.");
  return workshopRequest("/v1/workshop/" + String(code).toLowerCase() + "/like", { authorized: !!savedWorkshopSession()?.token });
});
// Leaderboard: top 5 and your own best for a drill; send a finished round (kept only if it beats your best).
// Refresh button in the Community Workshop: forget the shared catalog so the next read asks the service.
ipcMain.handle("aim:workshop:refresh", () => { communityCache = { at: 0, promise: null }; return true; });
ipcMain.handle("aim:workshop:scores", (_event, code) => {
  if (!/^[a-f0-9]{16}$/i.test(String(code || ""))) throw new Error("Invalid drill.");
  return workshopRequest("/v1/workshop/" + String(code).toLowerCase() + "/scores", { authorized: !!savedWorkshopSession()?.token });
});
ipcMain.handle("aim:workshop:submitScore", (_event, code, round) => {
  if (!/^[a-f0-9]{16}$/i.test(String(code || "")) || !round || typeof round !== "object") throw new Error("Invalid round.");
  const pick = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const body = { score: pick(round.score), seconds: pick(round.seconds), accuracy: pick(round.accuracy),
    killed: Number.isInteger(round.killed) ? round.killed : null, total: Number.isInteger(round.total) ? round.total : null };
  return workshopRequest("/v1/workshop/" + String(code).toLowerCase() + "/scores", { method: "POST", authorized: true, body });
});
// Moderator: set a drill's cover (base64 JPEG/PNG/WebP) or reset it (image null).
ipcMain.handle("aim:workshop:cover", async (_event, code, image, type) => {
  if (!/^[a-f0-9]{16}$/i.test(String(code || ""))) throw new Error("Invalid drill.");
  if (image !== null && (typeof image !== "string" || image.length > 290000 || !["image/jpeg", "image/png", "image/webp"].includes(type))) {
    throw new Error("Use a JPEG, PNG or WebP picture of at most 200 KB.");
  }
  try {
    return await workshopRequest("/v1/mod/" + String(code).toLowerCase() + "/cover",
      { method: "POST", authorized: true, body: image === null ? { image: null } : { image, type } });
  } catch (error) {
    if (/^not found\.?$/i.test(error.message || "")) throw new Error("The workshop server has not been updated for covers yet.");
    throw error;
  } finally {
    communityCache = { at: 0, promise: null };
  }
});
ipcMain.handle("aim:workshop:like", async (_event, code, on) => {
  if (!/^[a-f0-9]{16}$/i.test(String(code || "")) || typeof on !== "boolean") throw new Error("Invalid like request.");
  const result = await workshopRequest("/v1/workshop/" + String(code).toLowerCase() + "/like",
    { method: "POST", authorized: true, body: { on } });
  communityCache = { at: 0, promise: null }; // next catalog read shows the new count
  return result;
});
ipcMain.handle("aim:workshop:publish", async (_event, code) => {
  const entry = studio.all().find((item) => item.item.shareCode === code);
  if (!entry) throw new Error("Save the drill in Studio before publishing.");
  const scene = typeof entry.scene.doc === "string" ? JSON.parse(entry.scene.doc) : entry.scene.doc;
  return workshopRequest("/v1/workshop", { method: "POST", authorized: true, body: {
    title: entry.item.name, description: entry.item.description || "", scene,
  } });
});
ipcMain.handle("aim:workshop:pending", () => workshopRequest("/v1/mod/pending", { authorized: true }));
ipcMain.handle("aim:workshop:moderate", (_event, code, action) => {
  if (!/^[a-f0-9]{16}$/i.test(code) || !["approve", "reject", "hide", "unhide", "pin", "unpin", "delete", "ban"].includes(action)) {
    throw new Error("Invalid moderation request.");
  }
  return workshopRequest(`/v1/mod/${code}/${action}`, { method: "POST", authorized: true })
    .catch((error) => {
      // A workshop service from before 12 Nov 2026 has no Pin or Delete yet.
      if (["pin", "unpin", "delete"].includes(action) && /^not found.?$/i.test(error.message || "")) {
        throw new Error("The workshop server has not been updated for Pin and Delete yet.");
      }
      if (action === "ban" && /^not found.?$/i.test(error.message || "")) {
        throw new Error("The workshop server has not been updated for Ban yet. Deploy the new worker first.");
      }
      throw error;
    })
    .then((result) => {
      if (reviewPreview && reviewPreview.item.shareCode === code.toLowerCase()) reviewPreview = null;
      return result;
    })
    .finally(() => { communityCache = { at: 0, promise: null }; }); // the catalog just changed
});
ipcMain.handle("aim:workshop:published", () => workshopRequest("/v1/mod/published", { authorized: true }));
// unban-v1: banned accounts (moderator only, checked by the service) and unbanning one by its Discord ID.
const oldServiceForBan = (error) => {
  if (/^not found.?$/i.test(error.message || "")) throw new Error("The workshop server has not been updated for Unban yet. Deploy the new worker first.");
  throw error;
};
ipcMain.handle("aim:workshop:banned", () => workshopRequest("/v1/mod/banned", { authorized: true }).catch(oldServiceForBan));
ipcMain.handle("aim:workshop:unban", (_event, accountId) => {
  if (!/^\d{16,22}$/.test(String(accountId || ""))) throw new Error("Invalid account.");
  return workshopRequest(`/v1/mod/account/${accountId}/unban`, { method: "POST", authorized: true })
    .catch(oldServiceForBan)
    .finally(() => { communityCache = { at: 0, promise: null }; });
});
// Fetch an upload in any review state (moderator only, checked by the service) and list it
// in VALORANT Training so it can be played before a decision.
ipcMain.handle("aim:workshop:preview", async (_event, code) => {
  if (!/^[a-f0-9]{16}$/i.test(code)) throw new Error("Invalid upload.");
  const result = await workshopRequest(`/v1/mod/${code}/scene`, { authorized: true });
  const item = result.data && result.data.item, scene = result.data && result.data.scene;
  if (!item || !scene || item.shareCode !== code.toLowerCase() || typeof scene.doc !== "string") {
    throw new Error("The workshop service did not return this upload.");
  }
  reviewPreview = { item: { ...item, name: ("REVIEW: " + item.name).slice(0, 80), sort: 90 }, scene };
  return { code: item.shareCode };
});

app.whenReady().then(async () => {
  backups.onStartup();
  Menu.setApplicationMenu(null);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    let protocol = "";
    try {
      protocol = new URL(details.url).protocol;
    } catch {}
    const allowed = ALWAYS_ALLOWED.has(protocol) || isLocal(details.url);
    if (!allowed) console.log(`BLOCKED: ${details.url.slice(0, 120)}`);
    callback({ cancel: !allowed });
  });
  try {
    meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
  } catch {
    meta = {};
  }
  if (!isDir(OUT)) {
    dialog.showErrorBox("openVaim", `The game files are missing:\n${OUT}`);
    app.quit();
    return;
  }
  try {
    await startServer();
  } catch (err) {
    const msg = err && err.code === "EADDRINUSE"
      ? `Port ${PORT} is already in use by another program.\n\nClose it (for example a running aim_offline.py) and start AimTrainer again, or start it on another port with --port=<number> (for example --port=8001). Settings and training history are saved per port, and Discord sign-in for the Community Workshop only works on the usual port.`
      : `Could not start the local game server on port ${PORT}:\n${err && err.message}`;
    dialog.showErrorBox("openVaim", msg);
    app.quit();
    return;
  }
  mainWindow = createWindow(ORIGIN + START_PATH);
  // In-app updater (from 1.3.0): checks GitHub releases in the installed app only.
  require("./release-updates").register(() => mainWindow);
  mainWindow.on("closed", () => app.quit());
});

app.on("window-all-closed", () => app.quit());
