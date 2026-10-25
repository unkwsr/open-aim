// GitHub releases only. No renderer-supplied URLs, commands or install paths.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const API = "https://api.github.com/repos/unkwsr/open-aim/releases/latest";
const RELEASES = "https://github.com/unkwsr/open-aim/releases";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const MAX_INSTALLER = 2 * 1024 * 1024 * 1024;

function version(value) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
  return m && m.slice(1).map(Number);
}
function newer(candidate, current) {
  const a = version(candidate), b = version(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function parseRelease(data, current) {
  if (data.draft || data.prerelease || !newer(data.tag_name, current)) return null;
  const asset = data.assets?.find(a => a.name === "AimTrainer-Setup.exe" && a.state === "uploaded");
  const prefix = "https://github.com/unkwsr/open-aim/releases/download/";
  if (!asset || !asset.browser_download_url?.startsWith(prefix) ||
      !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_INSTALLER ||
      !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || "")) {
    throw new Error("This release has no verified Windows installer yet. Try again later or download it from GitHub.");
  }
  return { version: data.tag_name.replace(/^v/, ""), url: asset.browser_download_url,
    size: asset.size, sha256: asset.digest.slice(7).toLowerCase() };
}

function createUpdater(options) {
  const { currentVersion, userData, installDirectory, supported, notify = () => {},
    fetchImpl = globalThis.fetch, now = Date.now, launch = launchInstaller, quit = () => {} } = options;
  const prefFile = path.join(userData, "release-updates.json");
  const cache = path.join(userData, "update-downloads");
  // Only our stale download folders are removed; a newly launched installer
  // may still have its file open while it starts the updated app.
  try {
    for (const entry of fs.readdirSync(cache, { withFileTypes: true })) {
      const folder = path.join(cache, entry.name);
      if (entry.isDirectory() && entry.name.startsWith("installer-") &&
          now() - fs.statSync(folder).mtimeMs > 24 * 60 * 60 * 1000) fs.rmSync(folder, { recursive: true, force: true });
    }
  } catch {}
  let prefs = {};
  try { const saved = JSON.parse(fs.readFileSync(prefFile, "utf8")); if (saved && typeof saved === "object" && !Array.isArray(saved)) prefs = saved; } catch {}
  let state = { status: "idle", currentVersion, directory: installDirectory, supported,
    release: null, progress: 0, error: "" };
  let release = null, checking = null, controller = null, installing = false;
  const snapshot = () => ({ ...state, release: state.release && { ...state.release } });
  function update(values) { Object.assign(state, values); notify(snapshot()); return snapshot(); }
  function save(values) {
    const next = { ...prefs, ...values };
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(prefFile + ".tmp", JSON.stringify(next, null, 2));
    fs.renameSync(prefFile + ".tmp", prefFile); prefs = next;
  }
  async function check(manual = false) {
    if (controller || installing) return snapshot();
    if (checking) return checking;
    if (!manual && Number(prefs.snoozeUntil) > now()) return snapshot();
    checking = (async () => {
      update({ status: "checking", error: "" });
      try {
        const response = await fetchImpl(API, { headers: { Accept: "application/vnd.github+json", "User-Agent": "AimTrainer" }, signal: AbortSignal.timeout(15000) });
        if (response.status === 404) release = null;
        else {
          if (!response.ok) throw new Error(response.status === 403 || response.status === 429
            ? "GitHub is limiting update checks. Please try again later." : "Could not check GitHub for updates.");
          // Bound the API response as well as the installer download.
          const chunks = []; let size = 0;
          for await (const chunk of response.body) {
            size += chunk.length;
            if (size > 1024 * 1024) throw new Error("The release response is too large.");
            chunks.push(chunk);
          }
          release = parseRelease(JSON.parse(Buffer.concat(chunks).toString("utf8")), currentVersion);
        }
        const hidden = release && !manual && prefs.ignoredVersion === release.version;
        return update({ status: release && !hidden ? "available" : "latest", release: release && !hidden ? { version: release.version } : null });
      } catch (error) {
        release = null;
        return update({ status: "error", release: null, error: error.message === "fetch failed" ? "Could not reach GitHub. Check your connection and try again." : error.message || "Could not check for updates." });
      }
    })();
    try { return await checking; } finally { checking = null; }
  }
  function dismiss(action) {
    if (controller || installing) return snapshot();
    if (action === "skip" && release) save({ ignoredVersion: release.version });
    else if (action === "snooze") save({ snoozeUntil: now() + WEEK });
    else throw new Error("Unknown update preference.");
    return update({ status: "idle", release: null, error: "" });
  }
  function selectDirectory(directory) {
    if (controller || installing) throw new Error("Wait for the current update to finish.");
    validateDirectory(directory);
    return update({ directory });
  }
  async function install() {
    if (!supported) throw new Error("In-app installation is available in the installed Windows app. Portable and development builds can download releases from GitHub.");
    if (!release || state.status !== "available" || controller || installing) throw new Error("Check for an update before installing.");
    validateDirectory(state.directory);
    fs.mkdirSync(cache, { recursive: true });
    const directory = fs.mkdtempSync(path.join(cache, "installer-"));
    const file = path.join(directory, "AimTrainer-Setup.exe");
    controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60 * 1000)]);
    update({ status: "downloading", progress: 0, error: "" });
    try {
      const response = await fetchImpl(release.url, { signal });
      if (!response.ok) throw new Error("The installer download failed. Please try again.");
      const hash = crypto.createHash("sha256"); let size = 0, lastProgress = 0;
      const handle = await fs.promises.open(file, "wx");
      try {
        for await (const chunk of response.body) {
          signal.throwIfAborted(); size += chunk.length;
          if (size > release.size) throw new Error("The installer size does not match the release.");
          hash.update(chunk); await handle.writeFile(chunk);
          if (now() - lastProgress >= 250) { lastProgress = now(); update({ progress: Math.floor(size / release.size * 100) }); }
        }
      } finally { await handle.close(); }
      signal.throwIfAborted();
      if (size !== release.size || hash.digest("hex") !== release.sha256) throw new Error("Installer verification failed. Nothing was installed. Please try again.");
      validateDirectory(state.directory);
      // Flush Chromium storage before closing; the installer keeps AppData intact.
      await options.beforeInstall?.();
      signal.throwIfAborted(); installing = true;
      update({ status: "installing", progress: 100 });
      await launch(file, state.directory);
      quit();
      // The detached installer owns this temporary file until it exits.
      return snapshot();
    } catch (error) {
      installing = false;
      // Antivirus scanning can briefly lock the download on Windows. A cleanup
      // failure must not leave the UI stuck in the downloading state.
      try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
      return update({ status: "available", progress: 0, error: controller.signal.aborted
        ? "Download cancelled. Nothing was installed." : error.message });
    } finally { controller = null; }
  }
  return { snapshot, check, dismiss, selectDirectory, install,
    cancel() { if (!installing) controller?.abort(); },
    dispose() { if (!installing) controller?.abort(); } };
}

function validateDirectory(directory) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || /["\r\n]/.test(directory) ||
      path.parse(directory).root === path.resolve(directory)) throw new Error("Choose an application folder, not the root of a drive.");
  const entries = fs.readdirSync(directory);
  if (entries.length && !entries.some(name => name.toLowerCase() === "aimtrainer.exe")) {
    throw new Error("Choose the existing AimTrainer installation folder or an empty folder.");
  }
  // Existing all-users installs can require elevation. Let NSIS handle that
  // instead of rejecting Program Files because the running app is unelevated.
  if (entries.length) return;
  const probe = path.join(directory, ".aim-update-" + crypto.randomBytes(8).toString("hex"));
  try { fs.writeFileSync(probe, "", { flag: "wx" }); }
  catch { throw new Error("AimTrainer cannot write to this folder. Choose a writable installation folder."); }
  finally { if (fs.existsSync(probe)) fs.unlinkSync(probe); }
}

function installerArguments(directory) {
  // NSIS requires /D last and unquoted, including paths containing spaces.
  return ["/S", "--updated", "--force-run", "/D=" + directory];
}
function launchInstaller(file, directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, installerArguments(directory), {
      detached: true, stdio: "ignore", windowsHide: true, windowsVerbatimArguments: true,
    });
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}

function register(getWindow) {
  const { app, ipcMain, dialog, shell, session } = require("electron");
  const updater = createUpdater({ currentVersion: app.getVersion(), userData: app.getPath("userData"),
    installDirectory: path.dirname(process.env.PORTABLE_EXECUTABLE_FILE || app.getPath("exe")),
    supported: app.isPackaged && process.platform === "win32" && !process.env.PORTABLE_EXECUTABLE_FILE,
    notify(state) { const win = getWindow(); if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("aim:updates:state", state); },
    async beforeInstall() { session.defaultSession.flushStorageData(); await session.defaultSession.cookies.flushStore(); },
    quit: () => app.quit(),
  });
  function handle(name, callback) {
    ipcMain.handle("aim:updates:" + name, async event => {
      const win = getWindow();
      if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error("Update request rejected.");
      return callback(win);
    });
  }
  handle("state", () => updater.snapshot());
  handle("check", () => updater.check(true));
  handle("skip", () => updater.dismiss("skip"));
  handle("snooze", () => updater.dismiss("snooze"));
  handle("cancel", () => updater.cancel());
  handle("install", () => updater.install());
  handle("releases", () => shell.openExternal(RELEASES));
  handle("directory", async win => {
    const result = await dialog.showOpenDialog(win, { title: "Choose the AimTrainer installation folder",
      defaultPath: updater.snapshot().directory, properties: ["openDirectory", "createDirectory"] });
    return result.canceled ? updater.snapshot() : updater.selectDirectory(result.filePaths[0]);
  });
  // No network traffic from source checkouts, and no polling on the game loop.
  const initial = app.isPackaged ? setTimeout(() => updater.check(), 10000) : null;
  const interval = app.isPackaged ? setInterval(() => updater.check(), 6 * 60 * 60 * 1000) : null;
  initial?.unref(); interval?.unref();
  app.once("will-quit", () => { clearTimeout(initial); clearInterval(interval); updater.dispose(); });
  return updater;
}

module.exports = { createUpdater, parseRelease, newer, installerArguments, validateDirectory, register, WEEK };
