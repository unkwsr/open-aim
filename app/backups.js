// Backups of the player's data: training history, personal bests, settings and
// studio scenes. The game keeps them in Chromium storage inside the app's data
// folder, so a backup is a copy of those storage folders.
//
// - A backup is made at every launch, before the page opens the storage
//   (the last 10 launch backups are kept; manual and imported ones stay).
// - Restoring copies a backup back. Chromium holds the storage open while the app
//   runs, so a restore is scheduled, the app restarts, and it is applied first
//   thing on the next start (after one more backup of the current data).
// - Backups live in "<appData>/AimTrainer-Backups", outside the app's own folder.
const { app, dialog, session, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const DATA_DIRS = ["Local Storage", "IndexedDB", "WebStorage", "my-scenarios", "studio-drills"];
const KEEP_LAUNCH = 10;
const PENDING = "restore-pending.json";

const root = () => path.join(app.getPath("appData"), "AimTrainer-Backups");
const userData = () => app.getPath("userData");

function sizeOf(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? sizeOf(p) : fs.statSync(p).size;
  }
  return total;
}

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

// Copies the storage folders from `from` (a data folder or a backup) into a new backup.
function copyInto(from, reason) {
  fs.mkdirSync(root(), { recursive: true });
  let id = `${stamp()} ${reason}`;
  for (let i = 2; fs.existsSync(path.join(root(), id)); i++) id = `${stamp()} ${reason} ${i}`;
  const dest = path.join(root(), id);
  fs.mkdirSync(dest);
  for (const name of DATA_DIRS) {
    const src = path.join(from, name);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, name), { recursive: true });
  }
  fs.writeFileSync(path.join(dest, "backup.json"), JSON.stringify({ created: Date.now(), reason }, null, 2));
  return id;
}

function list() {
  if (!fs.existsSync(root())) return [];
  return fs.readdirSync(root(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(root(), e.name, "Local Storage")))
    .map((e) => {
      const dir = path.join(root(), e.name);
      let info = {};
      try { info = JSON.parse(fs.readFileSync(path.join(dir, "backup.json"), "utf-8")); } catch {}
      return { id: e.name, created: info.created || fs.statSync(dir).mtimeMs, reason: info.reason || "manual", size: sizeOf(dir) };
    })
    .sort((a, b) => b.created - a.created);
}

function pruneLaunchBackups() {
  for (const old of list().filter((b) => b.reason === "launch").slice(KEEP_LAUNCH)) {
    fs.rmSync(path.join(root(), old.id), { recursive: true, force: true });
  }
}

// Replaces the storage folders with the ones in `from`, all or nothing: the backup is
// first copied next to the live folders, then each live folder is renamed aside and
// the copy renamed into place. If anything fails, the live folders are put back.
// (Copying over a folder that could not be fully deleted nests the copy inside it,
// where Chromium never finds it; renames avoid that.)
function swapIn(from) {
  const ud = userData();
  const tag = `.restore-${Date.now()}`;
  const names = DATA_DIRS.filter((name) => fs.existsSync(path.join(from, name)));
  for (const name of names) fs.cpSync(path.join(from, name), path.join(ud, name + tag + ".new"), { recursive: true });
  const done = [];
  try {
    for (const name of names) {
      const live = path.join(ud, name);
      if (fs.existsSync(live)) fs.renameSync(live, path.join(ud, name + tag + ".old"));
      fs.renameSync(path.join(ud, name + tag + ".new"), live);
      done.push(name);
    }
  } catch (err) {
    for (const name of [...done].reverse()) {
      const live = path.join(ud, name);
      fs.renameSync(live, path.join(ud, name + tag + ".failed"));
      if (fs.existsSync(path.join(ud, name + tag + ".old"))) fs.renameSync(path.join(ud, name + tag + ".old"), live);
    }
    const rest = names.find((n) => !done.includes(n));
    if (rest && !fs.existsSync(path.join(ud, rest)) && fs.existsSync(path.join(ud, rest + tag + ".old"))) {
      fs.renameSync(path.join(ud, rest + tag + ".old"), path.join(ud, rest));
    }
    throw err;
  }
  // The replaced data is already saved as the "before restore" backup.
  for (const name of names) fs.rmSync(path.join(ud, name + tag + ".old"), { recursive: true, force: true });
}

// Called once at startup, before any window opens the storage.
function onStartup() {
  try {
    const pendingFile = path.join(root(), PENDING);
    if (fs.existsSync(pendingFile)) {
      const { id } = JSON.parse(fs.readFileSync(pendingFile, "utf-8"));
      fs.rmSync(pendingFile, { force: true });
      const from = path.join(root(), id);
      if (fs.existsSync(path.join(from, "Local Storage"))) {
        copyInto(userData(), "before restore");
        swapIn(from);
      }
    }
    if (fs.existsSync(path.join(userData(), "Local Storage"))) copyInto(userData(), "launch");
    pruneLaunchBackups();
  } catch (err) {
    console.log(`BACKUP: ${err && err.message}`);
  }
}

function scheduleRestore(id) {
  if (!fs.existsSync(path.join(root(), id, "Local Storage"))) throw new Error("That backup is missing its data.");
  fs.writeFileSync(path.join(root(), PENDING), JSON.stringify({ id }));
  // Quit normally (not app.exit) so Chromium finishes writing the current data first.
  setTimeout(() => { app.relaunch(); app.quit(); }, 300);
}

// While the app runs, Chromium keeps recent localStorage changes in memory for a
// while; write them out before copying the live folders.
async function backUpLive(reason) {
  session.defaultSession.flushStorageData();
  await new Promise((r) => setTimeout(r, 500));
  return copyInto(userData(), reason);
}

// IPC handlers for the Backups panel (window.__aimDesktop.backups in preload.js).
function register(ipcMain, getWindow) {
  ipcMain.handle("aim:backups:list", () => list());
  ipcMain.handle("aim:backups:create", () => backUpLive("manual"));
  ipcMain.handle("aim:backups:restore", (_e, id) => scheduleRestore(String(id)));
  ipcMain.handle("aim:backups:open", () => { fs.mkdirSync(root(), { recursive: true }); shell.openPath(root()); });
  ipcMain.handle("aim:backups:export", async (_e, id) => {
    const res = await dialog.showOpenDialog(getWindow(), { title: "Choose where to save the backup", properties: ["openDirectory", "createDirectory"] });
    if (res.canceled || !res.filePaths[0]) return null;
    const source = id ? path.join(root(), String(id)) : path.join(root(), await backUpLive("export"));
    const dest = path.join(res.filePaths[0], `AimTrainer backup ${stamp()}`);
    fs.cpSync(source, dest, { recursive: true });
    shell.showItemInFolder(path.join(dest, "backup.json"));
    return dest;
  });
  ipcMain.handle("aim:backups:import", async () => {
    const res = await dialog.showOpenDialog(getWindow(), { title: "Choose an AimTrainer backup folder", properties: ["openDirectory"] });
    if (res.canceled || !res.filePaths[0]) return null;
    const from = res.filePaths[0];
    if (!fs.existsSync(path.join(from, "Local Storage"))) throw new Error("That folder isn't an AimTrainer backup (no \"Local Storage\" folder inside).");
    const id = copyInto(from, "imported");
    scheduleRestore(id);
    return id;
  });
}

module.exports = { onStartup, register };
