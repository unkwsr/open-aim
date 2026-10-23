// Drills made in the Studio (studio/). Each one is a JSON file in "<userData>/studio-drills"
// holding the editable drill, plus the list entry and scene file the game reads. main.js
// merges the entries into the VALORANT Training list and serves the scenes like the built-in
// ones, so drills get results, personal bests and training history.
const { app } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TYPES = new Set(["aim", "hold", "flash", "moment", "basic"]);
const dir = () => path.join(app.getPath("userData"), "studio-drills");
const fileOf = (code) => path.join(dir(), `${String(code).replace(/[^0-9a-f]/gi, "")}.json`);

function read(file) {
  try {
    const entry = JSON.parse(fs.readFileSync(file, "utf-8"));
    return entry && entry.drill && entry.item && entry.scene ? entry : null;
  } catch {
    return null;
  }
}

function all() {
  if (!fs.existsSync(dir())) return [];
  return fs.readdirSync(dir())
    .filter((name) => name.endsWith(".json"))
    .map((name) => read(path.join(dir(), name)))
    .filter(Boolean)
    .sort((a, b) => String(b.item.updateTime).localeCompare(String(a.item.updateTime)));
}

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// drill: the Studio's own drill object; doc: the game scene compiled from it.
// Saving a drill that already has a code replaces that file and keeps its code.
// keepTime: an automatic re-save (newer scene format); the drill keeps its place in the lists.
function save({ drill, doc, type, keepTime }) {
  if (!drill || typeof drill !== "object") throw new Error("Nothing to save.");
  if (!doc || doc.schemaVersion !== 2 || !doc.meta) throw new Error("The drill could not be turned into a game scene.");
  const old = drill.code ? read(fileOf(drill.code)) : null;
  const code = old ? old.item.shareCode : crypto.randomBytes(8).toString("hex");
  const time = keepTime && old ? old.item.updateTime : now();
  doc.meta.id = `studio-${code}`;
  const title = String(drill.name || "My drill").slice(0, 60);
  const desc = String(drill.note || "").slice(0, 300);
  const text = JSON.stringify(doc);
  const par = doc.rules && doc.rules.moment && doc.rules.moment.parSeconds;
  const item = {
    createTime: old ? old.item.createTime : time, description: desc, docBytes: text.length, featured: false,
    mapId: doc.environment && doc.environment.map ? doc.environment.map : null, name: title, parSeconds: par || null,
    playCount: 0, sceneKey: `studio-${code}`, shareCode: code, sort: 90, status: 1, type: TYPES.has(type) ? type : "basic", updateTime: time,
  };
  const scene = {
    authorNickname: "You", authorUid: "local", blockCount: (doc.blocks || []).length, createTime: item.createTime, description: desc,
    docBytes: text.length, name: title, playCount: 0, sceneHash: crypto.createHash("sha1").update(text).digest("hex").slice(0, 16),
    sceneKey: item.sceneKey, schemaVersion: 2, shareCode: code, updateTime: time, doc: text,
  };
  const saved = { ...drill, code };
  fs.mkdirSync(dir(), { recursive: true });
  // Write next to the file, then rename over it, so a crash never leaves half a drill.
  const tmp = fileOf(code) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ drill: saved, item, scene }));
  fs.renameSync(tmp, fileOf(code));
  return { code, drill: saved };
}

function list() {
  return all().map((e) => ({ code: e.item.shareCode, name: e.item.name, note: e.item.description, mapId: e.item.mapId, type: e.item.type, updated: e.item.updateTime, drill: e.drill }));
}

function get(code) {
  const e = read(fileOf(code));
  return e ? e.drill : null;
}

function remove(code) {
  const file = fileOf(code);
  if (fs.existsSync(file)) fs.rmSync(file);
}

function register(ipcMain) {
  ipcMain.handle("aim:studio:list", () => list());
  ipcMain.handle("aim:studio:get", (_e, code) => get(code));
  ipcMain.handle("aim:studio:save", (_e, payload) => save(payload || {}));
  ipcMain.handle("aim:studio:remove", (_e, code) => remove(code));
}

module.exports = { all, register };
