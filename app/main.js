// Desktop wrapper for the offline open-aim game.
// Serves the site folder on 127.0.0.1:8000 exactly like aim_offline.py and
// opens http://localhost:8000/aim in a window.
const { app, BrowserWindow, Menu, dialog, ipcMain, screen, session, shell } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");
const backups = require("./backups");
const studio = require("./studio-store");

// Testing only: AIM_PROFILE=<folder> keeps all player data and backups in that folder,
// so test runs never touch the real save.
if (process.env.AIM_PROFILE) {
  app.setPath("appData", process.env.AIM_PROFILE);
  app.setPath("userData", path.join(process.env.AIM_PROFILE, "AimTrainer"));
}

// Testing only: AIM_PORT lets a test copy run while the real app is open.
const PORT = Number(process.env.AIM_PORT) || 8000;
const HOST = "127.0.0.1";
const ORIGIN = `http://localhost:${PORT}`;
const START_PATH = "/aim";
const SELF_NAME = "__self__"; // used when a URL path is both a file and a folder

// Packaged: site lives in resources/ (extraResources). Dev: one folder up.
const ROOT = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
const OUT = path.join(ROOT, "site");
const META_FILE = path.join(ROOT, "site_meta.json");
// Files in mods/ replace the site file at the same URL path (e.g. a weapon skin
// in mods/aim-viewmodel/). Packaged: resources/mods. Dev: desktop/mods.
const MODS = app.isPackaged ? path.join(process.resourcesPath, "mods") : path.join(__dirname, "mods");

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
// Startup screen over the half-loaded lobby until its training list is in.
const STARTUP_SCREEN_JS = fs.readFileSync(path.join(__dirname, "startup-screen.js"), "utf-8");
// Shared page watcher for the UI scripts below; sleeps while the mouse is locked in a round.
const PAGE_WATCH_JS = fs.readFileSync(path.join(__dirname, "page-watch.js"), "utf-8");
const SMOOTH_SCROLL_JS = fs.readFileSync(path.join(__dirname, "smooth-scroll.js"), "utf-8");
const VIDEO_SETTINGS_JS = fs.readFileSync(path.join(__dirname, "video-settings.js"), "utf-8");
// Interface: Performance / Enhanced (Settings > Video > Smoothness).
const INTERFACE_MODE_JS = fs.readFileSync(path.join(__dirname, "interface-mode.js"), "utf-8");
// Backups and sensitivity panels opened from the top bar.
const SNIPER_SCOPES_JS = fs.readFileSync(path.join(__dirname,"sniper-scopes.js"),"utf-8");
const FAN_AUDIO_JS = fs.readFileSync(path.join(__dirname,"fan-audio.js"),"utf-8");
const ADVANCED_TRACERS_JS = fs.readFileSync(path.join(__dirname, "advanced-tracers.js"), "utf-8");
const LOCAL_CUSTOMIZATION_JS = fs.readFileSync(path.join(__dirname, "local-customization.js"), "utf-8");
const PLAYER_TOOLS_JS = fs.readFileSync(path.join(__dirname, "player-tools.js"), "utf-8");
const VALORANT_IMPORT_JS = ["valorant-import.js", "valorant-import-ui.js"]
  .map(name => fs.readFileSync(path.join(__dirname, name), "utf-8")).join("\n");
const VALORANT_IMPORT_CSS = fs.readFileSync(path.join(__dirname, "valorant-import.css"), "utf-8");
const RELEASE_UPDATES_JS = fs.readFileSync(path.join(__dirname, "release-updates-ui.js"), "utf-8");
const RELEASE_UPDATES_CSS = fs.readFileSync(path.join(__dirname, "release-updates.css"), "utf-8");

// The Studio (studio/ folder, served at /studio/) replaces the site's own scenario editor:
// /aim/studio redirects there. studio-launch.js lets the Studio start a drill in the lobby.
const STUDIO_DIR = path.join(__dirname, "studio");
const STUDIO_PATH = "/studio/";
const STUDIO_LAUNCH_JS = fs.readFileSync(path.join(__dirname, "studio-launch.js"), "utf-8");

// Shooting error graph (shooting-error.js). The game's frame loop is served with one extra
// call that hands every shot (its total spread and the spray part) to the graph.
const SHOT_GRAPH_JS = fs.readFileSync(path.join(__dirname, "shooting-error.js"), "utf-8");
// One executeJavaScript call avoids Electron registering a did-stop-loading
// listener for each UI script while the page is still loading.
const UI_SCRIPTS = [
  ["PAGE WATCH", PAGE_WATCH_JS],
  ["SMOOTH SCROLL", SMOOTH_SCROLL_JS],
  ["SNIPER SCOPES", SNIPER_SCOPES_JS],
  ["FAN AUDIO", FAN_AUDIO_JS],
  ["ADVANCED TRACERS", ADVANCED_TRACERS_JS],
  ["LOCAL CUSTOMIZATION", LOCAL_CUSTOMIZATION_JS],
  ["PLAYER TOOLS", PLAYER_TOOLS_JS],
  ["INTERFACE MODE", INTERFACE_MODE_JS],
  ["FRAME METER", FRAME_METER_JS],
  ["VIDEO SETTINGS", VIDEO_SETTINGS_JS],
  ["LOBBY BAR", LOBBY_BAR_JS],
  ["STUDIO LAUNCH", STUDIO_LAUNCH_JS],
  ["SHOT GRAPH", SHOT_GRAPH_JS],
  ["RELEASE UPDATES", RELEASE_UPDATES_JS],
  ["VALORANT IMPORT", VALORANT_IMPORT_JS],
];
// The startup screen goes in on its own, straight away (see createWindow).
const STARTUP_SCREEN_RUN = `try {
${STARTUP_SCREEN_JS}
} catch (err) { console.error("STARTUP SCREEN:", err); }`;
const UI_SCRIPT_BATCH = UI_SCRIPTS.map(([name, source]) =>
  `try {\n${source}\n} catch (err) { console.error(${JSON.stringify(name)} + ":", err); }`
).join("\n");
const SHOT_LOOP_FILE = "/next/js/OkAdunfX.js";
const SHOT_LOOP_FROM = 'xe.kind==="shot"&&(Kt.push(xe.tick*ve)';
const SHOT_LOOP_TO = 'xe.kind==="shot"&&(window.__aimShot?.(xe),Kt.push(xe.tick*ve)';

// The site's English translator garbles some Vietnamese strings. Serve a thin
// wrapper in its place that applies translations.js first; the original module
// is still served unchanged under ORIGINAL_TRANSLATOR.
const TRANSLATOR = "/_assets/r20261021-1/i18n/translate-en.mjs";
const ORIGINAL_TRANSLATOR = "/_assets/r20261021-1/i18n/translate-en.original.mjs";
const TRANSLATOR_WRAPPER = `import dictionary from './en.dict.mjs';
import { translateText as base } from './translate-en.original.mjs';
export * from './translate-en.original.mjs';
// english-fixes.js: proper English replacing the dictionary's machine translations
// (the dictionary object is shared with the translator, which reads it lazily).
Object.assign(dictionary, ${JSON.stringify(require("./english-fixes"))});
const EXTRA = ${JSON.stringify(require("./translations"))};
const KEYS = Object.keys(EXTRA).sort((a, b) => b.length - a.length);
const VN = /[Ã Ã¡áº¡áº£Ã£Ã¢áº§áº¥áº­áº©áº«Äƒáº±áº¯áº·áº³áºµÃ¨Ã©áº¹áº»áº½Ãªá»áº¿á»‡á»ƒá»…Ã¬Ã­á»‹á»‰Ä©Ã²Ã³á»á»ÃµÃ´á»“á»‘á»™á»•á»—Æ¡á»á»›á»£á»Ÿá»¡Ã¹Ãºá»¥á»§Å©Æ°á»«á»©á»±á»­á»¯á»³Ã½á»µá»·á»¹Ä‘]/i;
${process.env.AIM_TRLOG ? "window.__trlog = new Map(); // AIM_TRLOG=1 (testing): records source -> English pairs shown" : ""}
export function translateText(value) {
  const source = value;
  if (typeof value === 'string' && VN.test(value)) {
    for (const key of KEYS) if (value.includes(key)) value = value.split(key).join(EXTRA[key]);
  }
  const result = base(value);
  if (window.__trlog && typeof source === 'string' && result !== source) window.__trlog.set(source.trim(), result.trim());
  return result;
}
`;
const ALWAYS_ALLOWED = new Set(["devtools:", "data:", "blob:", "about:", "chrome-extension:", "chrome:"]);

// Extra scenarios (training-set.json, built by tools/make_training_set.py) are added to
// the official training list and their scene files are served like the official ones,
// so they show up in the lobby with results and training history.
const WORKSHOP_LIST = "/prod-api/api/v1/public/val/aimlab/workshop";
const SCENE_PREFIX = "/prod-api/api/v1/public/val/aimlab/scenes/";
let trainingSet = { items: [], scenes: {} };
try {
  trainingSet = JSON.parse(fs.readFileSync(path.join(__dirname, "training-set.json"), "utf-8"));
} catch {}

const REMOVED_SCRIPTS = new Set([
  "/_assets/r20261021-1/js/performance-access.js",
  "/_assets/r20261021-1/js/performance-diagnostics-ui.mjs",
  "/_assets/r20261021-1/js/diagnostic-delivery.mjs",
]);

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

function diskPath(urlPath) {
  let p = decode(urlPath);
  if (p.endsWith("/")) p += "index.html";
  const parts = p.split("/").filter((x) => x !== "" && x !== "." && x !== "..");
  return parts.length ? path.join(OUT, ...parts) : path.join(OUT, "index.html");
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

function handle(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    // Online features (scores, accounts) don't exist offline.
    res.writeHead(404).end();
    return;
  }
  const url = new URL(req.url, ORIGIN);
  const requested = decode(url.pathname);
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
    const parts = requested.slice(STUDIO_PATH.length).split("/").filter((x) => x !== "" && x !== "." && x !== "..");
    const file = path.join(STUDIO_DIR, ...(parts.length ? parts : ["index.html"]));
    if (!isFile(file)) {
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
  const mine = rec ? [rec, ...studio.all()] : studio.all();
  if (requested === WORKSHOP_LIST && (trainingSet.items.length || mine.length)) {
    const [, listFile] = resolve(requested);
    try {
      const list = JSON.parse(fs.readFileSync(listFile, "utf-8"));
      const known = new Set(list.data.map((x) => x.shareCode));
      list.data = [...mine.map((e) => e.item), ...list.data, ...trainingSet.items.filter((x) => !known.has(x.shareCode))];
      sendJson(req, res, list);
      return;
    } catch {}
  }
  if (requested.startsWith(SCENE_PREFIX)) {
    const code = requested.slice(SCENE_PREFIX.length);
    const own = mine.find((e) => e.item.shareCode === code);
    const scene = own ? own.scene : trainingSet.scenes[code];
    if (scene) {
      sendJson(req, res, { code: "00000", data: scene, msg: "", local: true });
      return;
    }
  }
  if (requested.endsWith(SHOT_LOOP_FILE)) {
    const override = path.join(MODS, ...requested.split("/").filter(Boolean));
    const file = isFile(override) ? override : resolve(requested)[1];
    if (file) {
      const source = fs.readFileSync(file, "utf-8");
      if (!source.includes(SHOT_LOOP_FROM)) console.log("SHOT GRAPH: frame loop changed, graph gets no shots");
      const body = Buffer.from(source.replace(SHOT_LOOP_FROM, SHOT_LOOP_TO), "utf-8");
      res.writeHead(200, { "Content-Type": "text/javascript", "Content-Length": body.length, "Cache-Control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
  }
  if (requested === TRANSLATOR) {
    const body = Buffer.from(TRANSLATOR_WRAPPER, "utf-8");
    res.writeHead(200, { "Content-Type": "text/javascript", "Content-Length": body.length, "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  const parts = requested.split("/").filter((x) => x !== "" && x !== "." && x !== "..");
  const mod = parts.length ? path.join(MODS, ...parts) : null;
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
  const [urlPath, file] = resolve(requested === ORIGINAL_TRANSLATOR ? TRANSLATOR : req.url);
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
  const data = fs.readFileSync(file);
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
    // The Studio is a page of its own with its own look.
    if (new URL(win.webContents.getURL()).pathname.startsWith(STUDIO_PATH)) return show();
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
      setImmediate(() => win.loadURL(target));
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
require("./valorant-import-ipc").register(() => mainWindow, on => {
  const next = { ...shellSettings, vsync: on };
  fs.writeFileSync(SHELL_FILE, JSON.stringify(next, null, 2));
  shellSettings.vsync = on;
});
studio.register(ipcMain);

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
    dialog.showErrorBox("AimTrainer", `The game files are missing:\n${OUT}`);
    app.quit();
    return;
  }
  try {
    await startServer();
  } catch (err) {
    const msg = err && err.code === "EADDRINUSE"
      ? `Port ${PORT} is already in use by another program.\n\nClose it (for example a running aim_offline.py) and start AimTrainer again.`
      : `Could not start the local game server on port ${PORT}:\n${err && err.message}`;
    dialog.showErrorBox("AimTrainer", msg);
    app.quit();
    return;
  }
  mainWindow = createWindow(ORIGIN + START_PATH);
  require("./release-updates").register(() => mainWindow);
  mainWindow.on("closed", () => app.quit());
});

app.on("window-all-closed", () => app.quit());
