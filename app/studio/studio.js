// The Studio: make your own drills.
//
// Library -> pick a place -> place bots and targets on a top-down map -> tune them -> Play.
// Drills are saved by studio-store.js (main process) and played in the lobby's VALORANT
// Training list via studio-launch.js.
import {
  MAPS, mapLabel, WEAPONS, weaponLabel, LOOKS, SMOKE_AGENTS, RANKS, MOVES, ARMOR,
  newDrill, newBot, newTargets, newWall, newBarrier, newSmoke, itemName, problems, compile,
  FLASH_AGENTS, FLASH_FUSE, plan, flashTarget, normalize, COMPILER,
  BLOCK_SHAPES, BLOCK_COLORS, newBlock, structureTops, gameBlock,
} from "./drill.js";
import { loadMap } from "./map-data.js";
import { createView3D } from "./view3d.js";

const api = window.__aimDesktop && window.__aimDesktop.studio;
const app = document.getElementById("app");
const RANGE_SIZE = { small: 24, medium: 40, large: 70 };
const COACH_KEY = "studio-coach-done";

// The game's own scene checker, so a saved drill is always one the game accepts.
let gameCheck = null;
// It also splits building pieces into parts the way the game does (for the 3D view).
let gameParts = null;
import("/_assets/r20261021-1/next/js/D_iGclxB.js").then((m) => { gameCheck = m.p; gameParts = m.g; }).catch(() => {});

let catalog = [];
fetch("/local-api/maps").then((r) => r.json()).then((c) => (catalog = c.maps || [])).catch(() => {});

// ---------- tiny DOM helpers ----------
function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style") node.style.cssText = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) node.append(kid.nodeType ? kid : String(kid));
  return node;
}
const svg = (inner, cls = "") => {
  const s = document.createElement("span");
  s.style.display = "contents";
  s.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  return s.firstChild;
};
const ICON = {
  still: '<circle cx="12" cy="5" r="2.6"/><path d="M12 8v7M8 11h8M12 15l-3 6M12 15l3 6"/>',
  strafe: '<circle cx="12" cy="5" r="2.6"/><path d="M12 8v7M12 15l-2.5 6M12 15l2.5 6M2 12h5M4 10l-2 2 2 2M22 12h-5M20 10l2 2-2 2"/>',
  peek: '<path d="M3 3v18h7V3z" fill="currentColor" fill-opacity=".25"/><circle cx="16" cy="6" r="2.4"/><path d="M16 9v6M16 15l-2 5M16 15l2 5M13 11h6"/>',
  cross: '<circle cx="8" cy="5" r="2.4"/><path d="M8 8v6M8 14l-2 6M8 14l3 5M5 10h6M14 12h8M19 9l3 3-3 3"/>',
  patrol: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h5a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h8" stroke-dasharray="2 2.5"/>',
  targets: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  wall: '<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M3 12h18M9 7v5M15 12v5"/>',
  barrier: '<rect x="3" y="5" width="18" height="14" stroke-dasharray="3 3"/><path d="M9 12h6"/>',
  "b-box": '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  "b-floor": '<path d="M3 11l9-4 9 4-9 4z"/><path d="M3 11v2l9 4 9-4v-2"/>',
  "b-ramp": '<path d="M3 19h18V7z"/>',
  "b-stairs": '<path d="M3 20h4v-4h4v-4h4V8h4V4"/><path d="M3 20h18V4"/>',
  "b-window": '<rect x="3" y="4" width="18" height="16"/><rect x="7" y="8" width="10" height="5"/>',
  "b-door": '<rect x="3" y="4" width="18" height="16"/><path d="M9 20v-9h6v9"/>',
  "b-pillar": '<ellipse cx="12" cy="5" rx="5" ry="2"/><path d="M7 5v14c0 1 2.2 2 5 2s5-1 5-2V5"/>',
  "b-room": '<path d="M3 9l9-5 9 5v10H3z"/><path d="M10 19v-5h4v5"/>',
  smoke: '<path d="M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 .5 9z"/>',
  you: '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  flick: '<circle cx="17" cy="7" r="3"/><path d="M4 20l9-9" stroke-dasharray="2 2"/><path d="M4 20h3M4 20v-3"/>',
  micro: '<circle cx="8" cy="8" r="1.6"/><circle cx="15" cy="10" r="1.6"/><circle cx="10" cy="15" r="1.6"/><rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="2 2"/>',
  track: '<path d="M3 15c3-6 6-6 9 0s6 6 9 0"/><circle cx="12" cy="15" r="2"/>',
  react: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  duel: '<circle cx="7" cy="6" r="2.2"/><circle cx="17" cy="6" r="2.2"/><path d="M7 9v6M17 9v6M4 12h6M14 12h6M9 19l6-4M9 15l6 4"/>',
  blank: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
};
const ic = (name, cls) => svg(ICON[name], cls);

function toast(text, bad = false) {
  document.querySelector(".toast")?.remove();
  const t = h("div", { class: "toast" + (bad ? " bad" : ""), role: "status" }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), bad ? 5200 : 2600);
}

function confirmBox(title, text, buttons) {
  return new Promise((resolve) => {
    const close = (v) => { scrim.remove(); resolve(v); };
    const scrim = h("div", { class: "scrim", onclick: (e) => e.target === scrim && close(null) },
      h("div", { class: "dialog small", role: "dialog", "aria-modal": "true" },
        h("h2", {}, title), h("p", { class: "sub" }, text),
        h("div", { class: "foot" }, buttons.map(([label, value, cls]) => h("button", { class: `btn ${cls || ""}`, onclick: () => close(value) }, label)))));
    document.body.append(scrim);
    scrim.querySelector(".foot .btn:last-child")?.focus();
  });
}

// ---------- state ----------
const S = {
  screen: "library",
  drills: [],
  drill: null,
  saved: "", // JSON of the drill as last saved, to tell if there are changes
  sel: null, // item id, "start", or null (drill settings)
  tool: null, // what the next map click places: { kind, move? }
  addPoint: false, // clicking the map adds route points to the selected bot
  hist: [], fut: [], histKey: null, histAt: 0,
  map: null, img: null, mapLoading: false,
  view: null, preview: false,
};
window.__studio = S; // for checking the editor from DevTools
const dirty = () => S.drill && JSON.stringify(S.drill) !== S.saved;
const selItem = () => (S.drill && S.sel && S.sel !== "start" ? S.drill.items.find((i) => i.id === S.sel) || null : null);
const onMap = () => S.drill && S.drill.place !== "range";

// Floor height at (x, z) on the current map, nearest to nearY; null when there is no floor.
// Everything you can stand on at (x, z), lowest first: the map's floors (or the range floor)
// plus the tops of structures you built. skipId leaves one structure out (itself).
function levelsHere(x, z, skipId) {
  const base = onMap() ? (S.map ? S.map.levelsAt(x, z) : []) : [0];
  const tops = S.drill ? structureTops(S.drill.items, x, z, skipId) : [];
  return [...new Set([...base, ...tops])].sort((a, b) => a - b);
}
function floorAt(x, z, nearY, skipId) {
  if (onMap() && !S.map) return nearY ?? 0;
  const levels = levelsHere(x, z, skipId);
  if (!levels.length) return null;
  if (nearY === undefined || nearY === null) return levels[0];
  return levels.reduce((best, y) => (Math.abs(y - nearY) < Math.abs(best - nearY) ? y : best), levels[0]);
}
// For problems(): null where you can't stand (off the map's floors, or off the range).
function floorCheck() {
  if (!S.drill) return null;
  if (!onMap()) {
    const half = (RANGE_SIZE[S.drill.rangeSize] || 40) / 2;
    return (x, z) => (Math.abs(x) <= half && Math.abs(z) <= half ? 0 : null);
  }
  return S.map ? (x, z) => floorAt(x, z) : null;
}

// Every change goes through edit(): it records undo history and redraws.
// key: changes with the same key in quick succession (slider drags) are one undo step.
function edit(fn, { key = null, quiet = false } = {}) {
  const now = performance.now();
  if (!(key && key === S.histKey && now - S.histAt < 900)) {
    S.hist.push(JSON.stringify(S.drill));
    if (S.hist.length > 200) S.hist.shift();
    S.fut = [];
  }
  S.histKey = key;
  S.histAt = now;
  fn(S.drill);
  if (!quiet) renderSide();
  updateTop();
  draw();
}
function undo() {
  if (!S.hist.length) return;
  S.fut.push(JSON.stringify(S.drill));
  S.drill = JSON.parse(S.hist.pop());
  S.histKey = null;
  if (S.sel && S.sel !== "start" && !selItem()) S.sel = null;
  renderSide(); updateTop(); draw();
}
function redo() {
  if (!S.fut.length) return;
  S.hist.push(JSON.stringify(S.drill));
  S.drill = JSON.parse(S.fut.pop());
  S.histKey = null;
  if (S.sel && S.sel !== "start" && !selItem()) S.sel = null;
  renderSide(); updateTop(); draw();
}

// ---------- library ----------
async function refreshDrills() {
  try { S.drills = api ? await api.list() : []; } catch { S.drills = []; }
  // Drills saved by an older Studio are re-saved once so the game gets the current scene
  // (for example full-auto firing). Heights stored on the items are used; no map needed.
  let changed = false;
  for (const entry of S.drills) {
    if (entry.drill.compiled === COMPILER) continue;
    const drill = normalize(JSON.parse(JSON.stringify(entry.drill)));
    drill.compiled = COMPILER;
    try {
      const { doc, type } = compile(drill, null);
      if (gameCheck) gameCheck(JSON.stringify(doc));
      await api.save({ drill, doc, type, keepTime: true });
      changed = true;
    } catch (err) {
      console.warn("Couldn't update drill", entry.name, err);
    }
  }
  if (changed) try { S.drills = await api.list(); } catch {}
}

function summary(d) {
  const bots = d.items.filter((i) => i.kind === "bot").length;
  const zones = d.items.filter((i) => i.kind === "targets").length;
  const goal = { score: "Score kills", clear: "Clear them all", track: "Tracking" }[d.round.goal];
  const parts = [];
  if (bots) parts.push(`${bots} bot${bots > 1 ? "s" : ""}`);
  if (zones) parts.push(`${zones} target zone${zones > 1 ? "s" : ""}`);
  parts.push(`${d.round.time} s`, goal);
  return parts.join(" · ");
}

async function showLibrary() {
  S.screen = "library";
  S.drill = null;
  stopLoop();
  await refreshDrills();
  app.textContent = "";
  app.append(
    h("header", { class: "top" },
      h("button", { class: "btn ghost", onclick: () => location.assign("/aim"), title: "Back to the lobby" }, ic("back"), "Lobby"),
      h("div", { class: "brand" }, h("b", {}, "Studio"), h("span", {}, "Make your own drills")),
      h("div", { class: "grow" }),
      h("button", { class: "btn primary", onclick: newDrillDialog }, ic("plus"), "New drill")),
    h("main", { class: "library" },
      h("div", { class: "steps" },
        h("div", { class: "step" }, h("i", {}, "1"), h("div", {}, h("b", {}, "Pick a place"), h("span", {}, "The training range or any map."))),
        h("div", { class: "step" }, h("i", {}, "2"), h("div", {}, h("b", {}, "Drop in bots"), h("span", {}, "Choose what they do, drag them where you want."))),
        h("div", { class: "step" }, h("i", {}, "3"), h("div", {}, h("b", {}, "Press Play"), h("span", {}, "It saves and starts. Results go in your history.")))),
      h("div", { class: "lib-head" }, h("h2", {}, "My drills"), h("span", { class: "muted" }, S.drills.length ? `${S.drills.length}` : "")),
      h("div", { class: "cards" },
        h("button", { class: "card new-card", onclick: newDrillDialog }, h("span", {}, ic("plus"), "New drill")),
        S.drills.map(drillCard)),
      S.drills.length ? null : h("p", { class: "empty-note" }, "No drills yet. Your drills also show up first in VALORANT Training in the lobby.")));
}

function drillCard(entry) {
  const d = entry.drill;
  const map = d.place !== "range";
  return h("article", { class: "card" },
    h("div", { class: "art", style: map ? `background-image:url(/aim-maps/${d.place}.cover.webp)` : "background-image:repeating-linear-gradient(90deg,transparent 0 19px,#243444 19px 20px),repeating-linear-gradient(0deg,#1b2834 0 19px,#243444 19px 20px)" },
      h("span", { class: "place" }, map ? mapLabel(d.place) : "Training range")),
    h("div", { class: "body" }, h("h3", {}, entry.name), h("p", {}, summary(d))),
    h("div", { class: "actions" },
      h("button", { class: "btn primary small", onclick: () => play(entry.code) }, ic("play"), "Play"),
      h("button", { class: "btn small", onclick: () => openDrill(d) }, ic("edit"), "Edit"),
      h("div", { class: "grow" }),
      h("button", { class: "btn small icon", title: "Make a copy", "aria-label": "Make a copy", onclick: () => copyDrill(d) }, ic("copy")),
      h("button", { class: "btn small icon danger", title: "Delete", "aria-label": "Delete", onclick: () => deleteDrill(entry) }, ic("trash"))));
}

async function copyDrill(d) {
  const copy = JSON.parse(JSON.stringify(d));
  delete copy.code;
  copy.name = `${d.name} (copy)`.slice(0, 60);
  await saveDrill(copy, { quietOk: true });
  toast("Copied.");
  showLibrary();
}

async function deleteDrill(entry) {
  const ok = await confirmBox("Delete this drill?", `"${entry.name}" and its place in the training list will be removed. Your past results stay in your history.`, [["Cancel", false], ["Delete", true, "primary"]]);
  if (!ok) return;
  await api.remove(entry.code);
  toast("Deleted.");
  showLibrary();
}

// ---------- new drill ----------
const STARTERS = {
  range: [
    ["blank", "Empty range", "Start from nothing."],
    ["flick", "Flicks", "One target at a time anywhere in a wide area."],
    ["micro", "Micro-flicks", "Small targets close together."],
    ["react", "Reaction", "Targets that vanish fast."],
    ["track", "Tracking", "Keep your aim on a strafing bot."],
    ["duel", "Strafe duel", "Three strafers that shoot back."],
    ["peek", "Peeks", "Bots swing out from behind cover."],
  ],
  map: [["blank", "Empty map", "Your start is set on the map's spawn. Add bots where you want."]],
};

function starterDrill(place, kind) {
  const d = newDrill(place);
  const at = (x, z) => ({ x, y: 0, z });
  if (place !== "range") {
    const spawn = (catalog.find((m) => m.id === place) || {}).spawn || { x: 0, y: 0, z: 0 };
    d.start = { x: spawn.x, y: spawn.y, z: spawn.z, facing: 0 };
    d.round.move = true;
    d.name = `${mapLabel(place)} drill`;
    return d;
  }
  if (kind === "flick") {
    d.items.push(Object.assign(newTargets(at(0, -8)), { width: 12, height: 4, lift: 2.2 }));
    d.name = "Flicks";
  } else if (kind === "micro") {
    d.items.push(Object.assign(newTargets(at(0, -6)), { width: 3, height: 1.8, lift: 1.6, count: 3, size: "small" }));
    d.name = "Micro-flicks";
  } else if (kind === "react") {
    d.items.push(Object.assign(newTargets(at(0, -8)), { width: 9, height: 3, lift: 1.8, vanish: 0.9, color: "#ffb547" }));
    d.name = "Reaction";
  } else if (kind === "track") {
    d.items.push(Object.assign(newBot("strafe", at(0, -7)), { width: 5 }));
    d.round.goal = "track";
    d.name = "Tracking";
  } else if (kind === "duel") {
    for (const x of [-6, 0, 6]) d.items.push(Object.assign(newBot("strafe", at(x, -12)), { shoots: "gold", weapon: "vandal", width: 3 }));
    Object.assign(d.round, { move: true, die: true });
    d.name = "Strafe duel";
  } else if (kind === "peek") {
    d.items.push(Object.assign(newWall(at(-4, -10)), { length: 4, height: 2.5 }), Object.assign(newWall(at(4, -10)), { length: 4, height: 2.5 }));
    const left = newBot("peek", at(-4, -12));
    left.route = [{ x: -4, y: 0, z: -12, wait: 0 }, { x: -1.2, y: 0, z: -12, wait: 0 }];
    const right = newBot("peek", at(4, -12));
    right.route = [{ x: 4, y: 0, z: -12, wait: 0 }, { x: 1.2, y: 0, z: -12, wait: 0 }];
    for (const b of [left, right]) Object.assign(b, { x: b.route[0].x, z: b.route[0].z, shoots: "silver", weapon: "vandal", wait: 1.2 });
    d.items.push(left, right);
    d.round.order = "random";
    d.name = "Peeks";
  }
  return d;
}

function newDrillDialog() {
  let place = "range";
  let starter = "blank";
  const close = () => scrim.remove();
  const placesBox = h("div", { class: "places" });
  const startersBox = h("div", { class: "starters" });
  const render = () => {
    placesBox.textContent = "";
    placesBox.append(
      h("button", { class: "place-tile range" + (place === "range" ? " on" : ""), onclick: () => { place = "range"; starter = "blank"; render(); } }, h("small", {}, "Empty floor"), h("b", {}, "Training range")),
      ...MAPS.map(([id, label]) => h("button", {
        class: "place-tile" + (place === id ? " on" : ""), style: `background-image:url(/aim-maps/${id}.cover.webp)`,
        onclick: () => { place = id; starter = "blank"; render(); },
      }, h("small", {}, "Map"), h("b", {}, label))));
    startersBox.textContent = "";
    for (const [id, label, text] of STARTERS[place === "range" ? "range" : "map"]) {
      startersBox.append(h("button", { class: "starter" + (starter === id ? " on" : ""), onclick: () => { starter = id; render(); }, ondblclick: create },
        ic(ICON[id] ? id : "blank"), h("div", {}, h("b", {}, label), h("span", {}, text))));
    }
  };
  const create = () => {
    close();
    openDrill(starterDrill(place, starter), true);
  };
  const scrim = h("div", { class: "scrim", onclick: (e) => e.target === scrim && close() },
    h("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": "New drill" },
      h("h2", {}, "New drill"),
      h("p", { class: "sub" }, "Where do you want to train? You can change everything later."),
      h("h3", {}, "1 · Place"), placesBox,
      h("h3", {}, "2 · Start with"), startersBox,
      h("div", { class: "foot" }, h("button", { class: "btn", onclick: close }, "Cancel"), h("button", { class: "btn primary", onclick: create }, "Create"))));
  render();
  document.body.append(scrim);
}

// ---------- editor ----------
let canvas, ctx, stage, hintEl, side, topState, undoBtn, redoBtn;

async function openDrill(drill, fresh = false) {
  S.screen = "editor";
  S.drill = normalize(JSON.parse(JSON.stringify(drill)));
  S.saved = fresh ? "" : JSON.stringify(S.drill);
  S.sel = null; S.tool = null; S.addPoint = false;
  S.hist = []; S.fut = []; S.histKey = null;
  S.preview = false;
  S.map = null; S.img = null; S.view = null;
  buildEditor();
  if (onMap()) await loadPlace();
  fitView();
  // On a map, put the start on a real floor once the floors are known.
  if (onMap() && S.map && fresh) {
    const y = floorAt(S.drill.start.x, S.drill.start.z, S.drill.start.y);
    if (y !== null) S.drill.start.y = y;
  }
  renderSide();
  draw();
  maybeCoach();
}

async function loadPlace() {
  S.mapLoading = true;
  draw();
  const id = S.drill.place;
  try {
    const [map, img] = await Promise.all([
      loadMap(id, (u) => fetch(u).then((r) => r.json())),
      new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `/aim-maps/${id}.minimap.png`; }),
    ]);
    if (S.drill && S.drill.place === id) { S.map = map; S.img = img; }
  } catch {
    toast("This map's picture couldn't be loaded.", true);
  }
  S.mapLoading = false;
}

function buildEditor() {
  app.textContent = "";
  const nameInput = h("input", {
    class: "name-input", value: S.drill.name, maxlength: 60, "aria-label": "Drill name", spellcheck: "false",
    oninput: (e) => edit((d) => (d.name = e.target.value), { key: "name", quiet: true }),
  });
  undoBtn = h("button", { class: "btn icon ghost", title: "Undo (Ctrl+Z)", "aria-label": "Undo", onclick: undo }, ic("undo"));
  redoBtn = h("button", { class: "btn icon ghost", title: "Redo (Ctrl+Y)", "aria-label": "Redo", onclick: redo }, ic("redo"));
  topState = h("span", { class: "save-state" });
  app.append(h("header", { class: "top" },
    h("button", { class: "btn ghost", onclick: leaveEditor, title: "Back to your drills" }, ic("back"), "Drills"),
    nameInput, undoBtn, redoBtn, h("div", { class: "grow" }), topState,
    h("button", { class: "btn", onclick: () => saveCurrent() }, "Save"),
    h("button", { class: "btn primary", "data-coach": "play", onclick: () => saveCurrent(true) }, ic("play"), "Play")));

  const tool = (kind, move, iconName, cls, title, text) => {
    const btn = h("button", { class: "tool", "data-tool": move || kind, title: text },
      ic(iconName, cls), h("div", {}, h("b", {}, title), h("span", {}, text)));
    btn.addEventListener("pointerdown", (e) => trayDown(e, { kind, move }));
    return btn;
  };
  const tray = h("aside", { class: "tray", "data-coach": "tray", "aria-label": "Add to the map" },
    h("h4", {}, "Bots"),
    Object.entries(MOVES).map(([move, m]) => tool("bot", move, move, "ic-bot", m.short, m.tip)),
    h("h4", {}, "Targets"),
    tool("targets", null, "targets", "ic-target", "Target zone", "Floating targets pop up in an area."),
    h("h4", {}, "Build"),
    h("div", { class: "build-grid" },
      tool("wall", null, "wall", "ic-gear", "Wall", "Cover to peek from or hide behind."),
      Object.entries(BLOCK_SHAPES).map(([shape, s]) => tool("block", shape, `b-${shape}`, "ic-gear", s.label, s.tip))),
    tool("barrier", null, "barrier", "ic-air", "Invisible wall", "Keeps you (and bots) in. You can see and shoot through it."),
    h("h4", {}, "Utility"),
    tool("smoke", null, "smoke", "ic-gear", "Smoke", "Blocks sight at a set second."),
    h("h4", {}, "You"),
    tool("start", null, "you", "ic-you", "Your start", "Where you stand when the round starts."));

  canvas = h("canvas", { "aria-label": "Map. Click to place, drag to move, scroll to zoom." });
  ctx = canvas.getContext("2d");
  hintEl = h("div", { class: "hint" });
  const previewBtn = h("button", { class: "btn small preview-btn", title: "Show how the bots move", onclick: () => { S.preview = !S.preview; previewBtn.classList.toggle("on", S.preview); previewBtn.lastChild.textContent = S.preview ? "Stop preview" : "Preview moves"; draw(); } }, ic("eye"), "Preview moves");
  stage = h("section", { class: "stage", "data-coach": "map" }, canvas,
    h("div", { class: "zoom" },
      h("button", { class: "btn icon", title: "Zoom in", "aria-label": "Zoom in", onclick: () => zoomBy(1.3) }, ic("plus")),
      h("button", { class: "btn icon", title: "Zoom out", "aria-label": "Zoom out", onclick: () => zoomBy(1 / 1.3) }, ic("minus")),
      h("button", { class: "btn icon", title: "Show everything", "aria-label": "Show everything", onclick: () => { fitView(); draw(); } }, ic("fit"))),
    previewBtn, hintEl,
    h("div", { class: "view-switch", role: "radiogroup", "aria-label": "View" },
      h("button", { "data-view": "2d", onclick: () => setView(false) }, "2D"),
      h("button", { "data-view": "3d", onclick: () => setView(true) }, "3D")));
  side = h("aside", { class: "inspector", "data-coach": "side", "aria-label": "Settings" });
  app.append(h("div", { class: "editor" }, tray, stage, side));

  bindCanvas();
  view3d = null;
  setView(S.mode3d, true);
  new ResizeObserver(() => { const had = !!S.view; sizeCanvas(); if (!had) fitView(); draw(); }).observe(stage);
  updateTop();
}

function updateTop() {
  if (!topState) return;
  const d = dirty();
  topState.textContent = d ? "Unsaved changes" : S.drill.code ? "Saved" : "";
  topState.classList.toggle("dirty", d);
  undoBtn.disabled = !S.hist.length;
  redoBtn.disabled = !S.fut.length;
}

async function leaveEditor() {
  if (dirty()) {
    const pick = await confirmBox("Save your changes?", "You changed this drill since it was last saved.", [["Cancel", null], ["Don't save", "drop"], ["Save", "save", "primary"]]);
    if (!pick) return;
    if (pick === "save" && !(await saveCurrent())) return;
  }
  showLibrary();
}

// ---------- saving and playing ----------
// Items keep the floor height they were placed on, so a drill compiles the same with or
// without the map loaded (copies from the library); with it, heights are re-checked.
async function saveDrill(drill, { quietOk = false } = {}) {
  const current = S.drill === drill;
  const hard = problems(drill, current ? floorCheck() : null).filter((p) => !p.soft);
  if (hard.length) {
    toast(`Can't save yet: ${hard[0].text}`, true);
    return null;
  }
  drill.compiled = COMPILER;
  const { doc, type } = compile(drill, current && S.map ? (x, z, y) => floorAt(x, z, y) : null);
  if (gameCheck) {
    try {
      gameCheck(JSON.stringify(doc));
    } catch (err) {
      console.warn("Scene check:", err && err.message, doc);
      toast("The game couldn't read this drill. Try undoing the last change.", true);
      return null;
    }
  }
  try {
    const res = await api.save({ drill, doc, type });
    if (!quietOk) toast("Saved. It's also first in VALORANT Training.");
    return res;
  } catch (err) {
    toast(`Couldn't save: ${err && err.message}`, true);
    return null;
  }
}

async function saveCurrent(thenPlay = false) {
  const res = await saveDrill(S.drill, { quietOk: thenPlay });
  if (!res) return false;
  S.drill.code = res.code;
  S.saved = JSON.stringify(S.drill);
  updateTop();
  if (thenPlay) play(res.code);
  return true;
}

function play(code) {
  location.assign(`/aim#studio-play=${code}`);
}

// ---------- the map view ----------
// view: k = pixels per metre, (cx, cz) = world point at the centre of the canvas.
let W = 0, H = 0, DPR = 1;
function sizeCanvas() {
  const r = stage.getBoundingClientRect();
  DPR = window.devicePixelRatio || 1;
  W = r.width; H = r.height;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
}
// Maps are turned by quarter turns (clockwise) exactly like the game's minimap, so the
// Studio shows each map the way you see it in a round.
const MAP_TURNS = { ascent: 1, bonsai: 1, triad: 1, plummet: 0, jam: 0, infinity: 1, rook: 1, duality: 0 };
const turns = () => (onMap() ? MAP_TURNS[S.drill.place] || 0 : 0);
const turn = (a, b, q) => (q === 1 ? [-b, a] : q === 2 ? [-a, -b] : q === 3 ? [b, -a] : [a, b]);
// world (x, z) -> canvas [px, py]
function pt(x, z) {
  const [a, b] = turn(x - S.view.cx, z - S.view.cz, turns());
  return [W / 2 + a * S.view.k, H / 2 + b * S.view.k];
}
// canvas (px, py) -> world { x, z }
function toWorld(px, py) {
  const [dx, dz] = turn((px - W / 2) / S.view.k, (py - H / 2) / S.view.k, (4 - turns()) % 4);
  return { x: S.view.cx + dx, z: S.view.cz + dz };
}

function worldBounds() {
  if (onMap() && S.map && S.img) {
    const a = S.map.fromUV(0, 0), b = S.map.fromUV(1, 1);
    return { x0: a.x, z0: a.z, x1: b.x, z1: b.z };
  }
  const half = (RANGE_SIZE[S.drill.rangeSize] || 40) / 2;
  return { x0: -half, z0: -half, x1: half, z1: half };
}

function fitView() {
  if (!W) sizeCanvas();
  const b = worldBounds();
  const [w, d] = turns() % 2 ? [b.z1 - b.z0, b.x1 - b.x0] : [b.x1 - b.x0, b.z1 - b.z0];
  const k = Math.min(W / w, H / d) * 0.94;
  S.view = { k: k || 10, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 };
  // On a map, start zoomed in around your start spot.
  if (onMap() && S.map) S.view = { k: Math.max(k, 10), cx: S.drill.start.x, cz: S.drill.start.z };
}

// Keeps the world point under (px, py) in place while zooming.
function zoomBy(f, px = W / 2, py = H / 2) {
  const before = toWorld(px, py);
  S.view.k = Math.max(2, Math.min(80, S.view.k * f));
  const after = toWorld(px, py);
  S.view.cx += before.x - after.x;
  S.view.cz += before.z - after.z;
  draw();
}

// Direction a game yaw (degrees) looks at, in world x/z. Yaw 0 looks toward -z (up on an unturned map).
const dirOf = (deg) => ({ x: -Math.sin((deg * Math.PI) / 180), z: -Math.cos((deg * Math.PI) / 180) });
const yawDeg = (from, to) => ((Math.atan2(-(to.x - from.x), -(to.z - from.z)) * 180) / Math.PI + 360) % 360;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Side-to-side direction for a bot facing your start (for strafes and target zones).
function across(item) {
  const d = dirOf(facingOf(item));
  return { x: -d.z, z: d.x };
}
// Where a thing looks (game yaw, degrees): a bot's fixed direction, or toward your start.
const fixedFacing = (item) => item.kind === "bot" && typeof item.facing === "number" && (item.move === "still" || item.move === "strafe");
const facingOf = (item, at = item) => (fixedFacing(item) ? item.facing : yawDeg(at, S.drill.start));
function wallEnds(w) {
  const a = ((w.turn || 0) * Math.PI) / 180;
  const ux = Math.cos(a), uz = -Math.sin(a);
  return [{ x: w.x - (ux * w.length) / 2, z: w.z - (uz * w.length) / 2 }, { x: w.x + (ux * w.length) / 2, z: w.z + (uz * w.length) / 2 }];
}

// Where a bot is at time t in the preview (seconds).
function previewPos(b, t) {
  const speed = b.speed === "walk" ? 2.97 : 5.4;
  if (b.move === "strafe") {
    const a = across(b);
    const half = b.width / 2;
    const period = (2 * b.width) / speed + 1;
    const p = (t % period) / period;
    const s = p < 0.5 ? -half + Math.min(1, (p * period) / (b.width / speed)) * b.width : half - Math.min(1, ((p - 0.5) * period) / (b.width / speed)) * b.width;
    return { x: b.x + a.x * s, z: b.z + a.z * s, shown: true };
  }
  // The same route the game gets (plan() in drill.js): stops, A-D steps, flash, loop or vanish.
  const p = plan(b, S.drill.start, takingTurns());
  if (!p) return { x: b.x, z: b.z, shown: true };
  const legs = [];
  let total = 0;
  const pts = p.pts;
  let flashStart = -1;
  const wait = (at, time, flash) => { if (flash) flashStart = total; legs.push({ at, time }); total += time; };
  const walk = (from, to) => { const time = dist(from, to) / speed; legs.push({ from, to, time }); total += time; };
  pts.forEach((q, i) => {
    if (i === p.flashAt) wait(q, b.flash.wait ?? 1, true);
    else if (q.wait > 0) wait(q, q.wait);
    if (i < pts.length - 1) walk(q, pts[i + 1]);
  });
  if (p.loop) walk(pts[pts.length - 1], pts[0]);
  else wait(pts[pts.length - 1], p.hidden, false), (legs[legs.length - 1].hidden = true);
  const now = t % (total || 1);
  // Seconds since the flash was thrown, while it flies and pops.
  const age = flashStart >= 0 && now >= flashStart && now - flashStart < FLASH_FUSE + 0.6 ? now - flashStart : undefined;
  let left = now;
  for (const leg of legs) {
    if (left > leg.time) { left -= leg.time; continue; }
    if (leg.from) {
      const f = leg.time ? left / leg.time : 1;
      return { x: leg.from.x + (leg.to.x - leg.from.x) * f, z: leg.from.z + (leg.to.z - leg.from.z) * f, shown: true, flashAge: age };
    }
    return { x: leg.at.x, z: leg.at.z, shown: !leg.hidden, flashAge: age };
  }
  return { x: pts[0].x, z: pts[0].z, shown: true };
}

// Bots take turns (so a peeker peeks once and hides).
const takingTurns = () => S.drill.round.order !== "together" && S.drill.round.goal !== "track";

// Draws a bot's flash: the throw path to where it pops and, in the preview, the flash
// flying (FLASH_FUSE seconds) and popping.
function drawFlash(b, isSel, flashAge) {
  const p = plan(b, S.drill.start, takingTurns());
  const target = flashTarget(b, S.drill.start);
  if (!p || p.flashAt < 0 || !target) return;
  const from = p.pts[p.flashAt];
  const curve = flashCurve(b, from, target);
  ctx.strokeStyle = isSel ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.45)";
  ctx.lineWidth = isSel ? 2 : 1.4;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) { const q = curve(i / 16); i ? ctx.lineTo(...pt(q.x, q.z)) : ctx.moveTo(...pt(q.x, q.z)); }
  ctx.stroke();
  ctx.setLineDash([]);
  const [tx, ty] = pt(target.x, target.z);
  if (flashAge !== undefined && flashAge < FLASH_FUSE) {
    const q = curve(flashAge / FLASH_FUSE);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(...pt(q.x, q.z), 5, 0, Math.PI * 2); ctx.fill();
  } else if (flashAge !== undefined && flashAge < FLASH_FUSE + 0.6) {
    const k = (flashAge - FLASH_FUSE) / 0.6;
    const r = 10 + k * Math.max(30, 6 * S.view.k);
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill();
  }
  // The pop point: a star you can drag.
  ctx.fillStyle = isSel ? "#fff" : "rgba(255,255,255,.8)";
  ctx.strokeStyle = "#0a1118"; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 4 : 10;
    ctx.lineTo(tx + Math.cos(a) * r, ty + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

// Throw path from `from` to `to` (world x/z) for the bot's flash; Phoenix and Skye curve.
function flashCurve(b, from, to) {
  const f = b.flash;
  const side = (f.agent || "phoenix") === "phoenix" ? (f.curve === "left" ? -1 : 1) : f.agent === "skye" ? ({ left: -1, right: 1 }[f.curve] || 0) : 0;
  const dx = to.x - from.x, dz = to.z - from.z;
  // (-dz, dx) points to the thrower's right.
  const c = { x: (from.x + to.x) / 2 - dz * 0.35 * side, z: (from.z + to.z) / 2 + dx * 0.35 * side };
  return (t) => ({ x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * c.x + t * t * to.x, z: (1 - t) * (1 - t) * from.z + 2 * (1 - t) * t * c.z + t * t * to.z });
}

let raf = 0;
function draw() {
  if (S.screen !== "editor" || !ctx) return;
  if (!raf) raf = requestAnimationFrame(frame);
}
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

// ---------- 3D view ----------
let view3d = null;
try { S.mode3d = localStorage.getItem("studio-view") === "3d"; } catch { S.mode3d = false; }

function setView(on, first = false) {
  S.mode3d = on;
  try { localStorage.setItem("studio-view", on ? "3d" : "2d"); } catch {}
  if (on && !view3d) {
    view3d = createView3D(stage);
    bind3D(view3d);
    view3d.resize();
    const st = S.drill.start;
    view3d.frame(st, st.y || 0, st.facing || 0);
  }
  canvas.style.display = on ? "none" : "";
  if (view3d) { view3d.canvas.style.display = on ? "" : "none"; view3d.labels.style.display = on ? "" : "none"; }
  stage.querySelector(".zoom").style.display = on ? "none" : "";
  for (const b of stage.querySelectorAll(".view-switch button")) b.classList.toggle("on", (b.dataset.view === "3d") === on);
  if (!first) draw();
}

// What the 3D view needs from the editor.
const helpers3d = {
  floorAt: (x, z, y, skip) => floorAt(x, z, y, skip),
  gameBlock: (b, id, baseY) => gameBlock(b, id, baseY),
  blockParts: (block) => (gameParts ? gameParts(block) : [{ shape: block.shape === "cylinder" ? "cylinder" : "box", center: { x: 0, y: 0, z: 0 }, half: { x: block.size.x / 2, y: block.size.y / 2, z: block.size.z / 2 } }]),
  label: (it) => itemName(S.drill, it) + (it.kind === "bot" && it.shoots !== "off" ? " · shoots" : ""),
  facingOf: (it) => facingOf(it),
  fixedFacing: (it) => fixedFacing(it),
  across: (it) => across(it),
  wallEnds: (it) => wallEnds(it),
  dir: (deg) => dirOf(deg),
  previewPos: (it, t) => previewPos(it, t),
  FUSE: FLASH_FUSE,
  // Throw path of a bot's flash: curve on the ground plan, heights at both ends.
  flashPath(it) {
    if (!it.flash || !it.flash.on) return null;
    const p = plan(it, S.drill.start, takingTurns());
    const target = flashTarget(it, S.drill.start);
    if (!p || p.flashAt < 0 || !target) return null;
    const from = p.pts[p.flashAt];
    const fromY = floorAt(from.x, from.z, from.y) ?? from.y ?? 0;
    return { curve: flashCurve(it, from, target), target, fromY, toY: fromY + (it.flash.height ?? 2.2) };
  },
};

function paint3d(t) {
  view3d.setWorld(onMap() ? S.map : null, RANGE_SIZE[S.drill.rangeSize] || 40);
  view3d.sync(S.drill, S.sel, helpers3d, S.preview);
  if (S.preview) view3d.animate(t, helpers3d); else view3d.still(helpers3d);
  view3d.render();
}

// 3D mouse: left-drag empty space turns the camera, right-drag (or Shift+left) moves it,
// scroll zooms. Clicking and dragging things works like in 2D.
function bind3D(v) {
  const c = v.canvas;
  let mode = null, last = null, travel = 0;
  const local = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const toHit = (d) => {
    if (!d) return null;
    if (d.type === "start" || d.type === "turn") return { type: d.type };
    const item = S.drill.items.find((i) => i.id === d.id);
    return item ? { ...d, item } : null;
  };
  c.addEventListener("pointerdown", (e) => {
    c.setPointerCapture(e.pointerId);
    const [px, py] = local(e);
    last = { x: e.clientX, y: e.clientY };
    travel = 0;
    if (e.button === 2) {
      const hit = toHit(v.pick(px, py));
      if (hit && hit.type === "point") { removePoint(hit.item, hit.index); mode = null; return; }
      mode = "pan"; return;
    }
    if (e.button === 1 || (e.button === 0 && e.shiftKey && !S.tool)) { mode = "pan"; return; }
    if (e.button !== 0) return;
    if (S.tool) { const at = v.surfacePoint(px, py); if (at) place(S.tool, at); if (!e.shiftKey) setTool(null); mode = null; return; }
    const sel = selItem();
    if (S.addPoint && sel && sel.route) { const at = v.surfacePoint(px, py); if (at) addPoint(sel, at); mode = null; return; }
    const hit = toHit(v.pick(px, py));
    if (!hit) { mode = "orbit"; return; }
    const target = hit.item ? hit.item.id : "start";
    if (target !== S.sel) { S.sel = target; S.addPoint = false; renderSide(); }
    const obj = hit.item || S.drill.start;
    const planeY = floorAt(obj.x, obj.z, obj.y, obj.kind === "block" ? obj.id : undefined) ?? obj.y ?? 0;
    const at = v.planePoint(px, py, planeY) || { x: obj.x, z: obj.z };
    drag = { ...hit, key: `drag-${Date.now()}`, dx: obj.x - at.x, dz: obj.z - at.z, moved: false, planeY };
    mode = "drag";
    draw();
  });
  c.addEventListener("pointermove", (e) => {
    const [px, py] = local(e);
    pointer.x = px; pointer.y = py; pointer.inside = true;
    if (!mode) { c.style.cursor = S.tool || S.addPoint ? "crosshair" : v.pick(px, py) ? "pointer" : ""; return; }
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    travel += Math.abs(dx) + Math.abs(dy);
    if (mode === "orbit") v.orbitBy(dx, dy);
    else if (mode === "pan") v.panBy(dx, dy);
    else if (mode === "drag" && drag) {
      // Things you move follow the surface under the mouse, so dragging a bot onto a built
      // floor puts it on top; handles (widths, turns, the flash star) stay at their height.
      const onSurface = drag.type === "item" || drag.type === "start" || drag.type === "point";
      const at = onSurface ? v.surfacePoint(px, py, drag.item && drag.item.kind === "block" ? drag.item.id : undefined) : v.planePoint(px, py, drag.planeY);
      if (at) dragMove(e, at);
    }
    draw();
  });
  const end = () => {
    // A click on empty space (no camera turn) clears the selection, like in 2D.
    if (mode === "orbit" && travel < 4 && S.sel !== null) { S.sel = null; S.addPoint = false; renderSide(); }
    if (drag && drag.moved) renderSide();
    drag = null; mode = null;
    draw();
  };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", end);
  c.addEventListener("contextmenu", (e) => e.preventDefault());
  c.addEventListener("wheel", (e) => { e.preventDefault(); v.zoomBy(Math.exp(-e.deltaY * 0.0015)); draw(); }, { passive: false });
  new ResizeObserver(() => { v.resize(); draw(); }).observe(stage);
}
function frame(now) {
  raf = 0;
  if (S.mode3d && view3d) paint3d(now / 1000);
  else paint(now / 1000);
  updateHint();
  if (S.preview) raf = requestAnimationFrame(frame);
}

const COLORS = { bot: "#ff4655", botSel: "#ffffff", start: "#43f08a", route: "#ffb547", target: "#2fe0c8", wall: "#9aa4ae", smoke: "#a974ff", bad: "#ff4655" };

function paint(t) {
  if (!S.view) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#07090c";
  ctx.fillRect(0, 0, W, H);
  const k = S.view.k;
  const d = S.drill;

  // Ground
  if (onMap()) {
    if (S.img && S.map) {
      const b = worldBounds();
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.95;
      ctx.save();
      ctx.translate(...pt(b.x0, b.z0));
      ctx.rotate((turns() * Math.PI) / 2);
      ctx.drawImage(S.img, 0, 0, (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#8d9aa6";
      ctx.font = "14px Bahnschrift, Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("Loading the map…", W / 2, H / 2);
    }
  } else {
    const half = (RANGE_SIZE[d.rangeSize] || 40) / 2;
    const [x0, y0] = pt(-half, -half);
    ctx.fillStyle = "#12161d";
    ctx.fillRect(x0, y0, half * 2 * k, half * 2 * k);
    ctx.lineWidth = 1;
    for (let m = -half; m <= half; m += 1) {
      ctx.strokeStyle = m === 0 ? "rgba(255,70,85,.45)" : m % 5 === 0 ? "rgba(140,160,180,.28)" : "rgba(140,160,180,.09)";
      if (k < 6 && m % 5 !== 0) continue;
      line(m, -half, m, half);
      line(-half, m, half, m);
    }
    ctx.strokeStyle = "rgba(140,160,180,.5)";
    ctx.strokeRect(x0, y0, half * 2 * k, half * 2 * k);
  }

  const fc = floorCheck();
  const bad = (x, z) => fc && fc(x, z) === null;
  const sel = S.sel;

  // Your view cone
  const st = d.start;
  const look = dirOf(st.facing);
  const reach = 30;
  ctx.fillStyle = "rgba(67,240,138,.08)";
  ctx.beginPath();
  ctx.moveTo(...pt(st.x, st.z));
  const fov = (103 / 2) * (Math.PI / 180);
  for (let a = -fov; a <= fov + 1e-6; a += fov / 12) {
    const c = Math.cos(a), s = Math.sin(a);
    ctx.lineTo(...pt(st.x + (look.x * c - look.z * s) * reach, st.z + (look.x * s + look.z * c) * reach));
  }
  ctx.closePath();
  ctx.fill();

  // Smokes
  for (const it of d.items.filter((i) => i.kind === "smoke")) {
    ctx.fillStyle = "rgba(169,116,255,.22)";
    ctx.strokeStyle = it.id === sel ? "#fff" : "rgba(169,116,255,.8)";
    ctx.lineWidth = it.id === sel ? 2 : 1.2;
    ctx.beginPath(); ctx.arc(...pt(it.x, it.z), 4.5 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    label(it, it, 4.5 * k + 6, it.id === sel);
  }

  // Structures, lowest first so raised floors draw over the ground pieces
  for (const it of d.items.filter((i) => i.kind === "block").sort((a, b) => (a.y + a.lift) - (b.y + b.lift))) drawBlock(it, it.id === sel, bad(it.x, it.z));

  // Walls
  for (const it of d.items.filter((i) => i.kind === "wall")) {
    const [a, b] = wallEnds(it);
    ctx.lineCap = "butt";
    ctx.strokeStyle = "#0a1118";
    ctx.lineWidth = Math.max(8, 0.3 * k + 4);
    line(a.x, a.z, b.x, b.z);
    ctx.strokeStyle = bad(it.x, it.z) ? COLORS.bad : it.id === sel ? "#fff" : it.invisible ? "#7fd8ff" : "#ffd166";
    ctx.lineWidth = Math.max(4, 0.3 * k);
    // Invisible walls: dashed light blue.
    if (it.invisible) ctx.setLineDash([8, 6]);
    line(a.x, a.z, b.x, b.z);
    ctx.setLineDash([]);
    label(it, it, 10, it.id === sel);
    if (it.id === sel) for (const p of [a, b]) handle(p.x, p.z, "#fff");
  }

  // Target zones
  for (const it of d.items.filter((i) => i.kind === "targets")) {
    const a = across(it);
    const half = Math.max(0.3, it.width / 2);
    const p1 = { x: it.x - a.x * half, z: it.z - a.z * half }, p2 = { x: it.x + a.x * half, z: it.z + a.z * half };
    ctx.strokeStyle = it.color || COLORS.target;
    ctx.lineWidth = it.id === sel ? 4 : 3;
    ctx.setLineDash([6, 4]);
    line(p1.x, p1.z, p2.x, p2.z);
    ctx.setLineDash([]);
    const n = Math.max(1, Math.min(it.count, 6));
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      const wob = S.preview && it.motion !== "still" ? Math.sin(t * (it.motion === "fast" ? 5 : 2.2) + i) * (it.motion === "fast" ? 1.2 : 0.5) : 0;
      const px = p1.x + (p2.x - p1.x) * f + a.x * wob, pz = p1.z + (p2.z - p1.z) * f + a.z * wob;
      ctx.fillStyle = it.color || COLORS.target;
      ctx.beginPath(); ctx.arc(...pt(px, pz), Math.max(4, 0.25 * k), 0, Math.PI * 2); ctx.fill();
    }
    if (it.id === sel) { handle(p1.x, p1.z, "#fff"); handle(p2.x, p2.z, "#fff"); }
    label(it, it, 14, it.id === sel);
  }

  // Bots: routes, then bodies
  for (const it of d.items.filter((i) => i.kind === "bot")) {
    const isSel = it.id === sel;
    if (it.route) {
      ctx.strokeStyle = isSel ? COLORS.route : "rgba(255,181,71,.55)";
      ctx.lineWidth = isSel ? 2.5 : 1.6;
      ctx.setLineDash(it.move === "patrol" ? [2, 5] : [7, 5]);
      ctx.beginPath();
      it.route.forEach((p, i) => (i ? ctx.lineTo(...pt(p.x, p.z)) : ctx.moveTo(...pt(p.x, p.z))));
      if (it.move === "patrol" && it.route.length > 2) ctx.lineTo(...pt(it.route[0].x, it.route[0].z));
      ctx.stroke();
      ctx.setLineDash([]);
      const last = it.route[it.route.length - 1], prev = it.route[it.route.length - 2];
      if (prev && it.move !== "patrol") arrow(prev, last, isSel ? COLORS.route : "rgba(255,181,71,.7)");
      if (isSel || it.route.length) {
        it.route.forEach((p, i) => {
          const first = i === 0, end = i === it.route.length - 1;
          const color = bad(p.x, p.z) ? COLORS.bad : first ? COLORS.start : end && it.move !== "patrol" ? "#ff4655" : COLORS.route;
          if (isSel) {
            handle(p.x, p.z, color, String(i + 1));
            if (p.wait > 0 || (it.move === "peek" && i === 1)) {
              ctx.fillStyle = "#ffd28a"; ctx.font = "600 11px Bahnschrift, Segoe UI"; ctx.textAlign = "center";
              const [qx, qy] = pt(p.x, p.z);
              ctx.fillText(`waits ${(it.move === "peek" ? it.wait : p.wait).toFixed(1)} s`, qx, qy + 22);
            }
          } else if (!first) {
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(...pt(p.x, p.z), 3, 0, Math.PI * 2); ctx.fill();
          }
        });
      }
    }
    if (it.move === "strafe") {
      const a = across(it), half = it.width / 2;
      const p1 = { x: it.x - a.x * half, z: it.z - a.z * half }, p2 = { x: it.x + a.x * half, z: it.z + a.z * half };
      ctx.strokeStyle = isSel ? COLORS.route : "rgba(255,181,71,.55)";
      ctx.lineWidth = isSel ? 2.5 : 1.6;
      line(p1.x, p1.z, p2.x, p2.z);
      arrow(it, p1, ctx.strokeStyle); arrow(it, p2, ctx.strokeStyle);
      if (isSel) { handle(p1.x, p1.z, COLORS.route); handle(p2.x, p2.z, COLORS.route); }
    }
    if (it.move === "peek" && it.peekStrafe && it.route) {
      // A-D steps at the peek spot.
      const s = it.route[1], a = across(s);
      const p1 = { x: s.x - a.x * 0.6, z: s.z - a.z * 0.6 }, p2 = { x: s.x + a.x * 0.7, z: s.z + a.z * 0.7 };
      ctx.strokeStyle = isSel ? COLORS.route : "rgba(255,181,71,.55)";
      ctx.lineWidth = 2;
      line(p1.x, p1.z, p2.x, p2.z);
      arrow(s, p1, ctx.strokeStyle); arrow(s, p2, ctx.strokeStyle);
    }
    const at = S.preview ? previewPos(it, t) : { x: it.x, z: it.z, shown: true };
    if (it.flash && it.flash.on) drawFlash(it, isSel, S.preview ? at.flashAge : undefined);
    if (at.shown) body(it, at, isSel, bad(it.x, it.z));
    label(it, at, Math.max(12, 0.45 * k) + 6, isSel);
  }

  // You
  const r = Math.max(13, 0.45 * k);
  const [yx, yy] = pt(st.x, st.z);
  ctx.fillStyle = bad(st.x, st.z) ? COLORS.bad : COLORS.start;
  ctx.strokeStyle = sel === "start" ? "#fff" : "#0a1118";
  ctx.lineWidth = sel === "start" ? 3 : 2;
  ctx.beginPath(); ctx.arc(yx, yy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#06210f"; ctx.font = `800 ${Math.max(9, r * 0.62)}px Bahnschrift, Segoe UI`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("YOU", yx, yy + 0.5);
  ctx.textBaseline = "alphabetic";
  const tip = { x: st.x + look.x * 4, z: st.z + look.z * 4 };
  ctx.strokeStyle = COLORS.start; ctx.lineWidth = 2;
  line(st.x + look.x * (r / k), st.z + look.z * (r / k), tip.x, tip.z);
  handle(tip.x, tip.z, COLORS.start);

  if (S.tool && pointer.inside) ghost();
}

function body(it, at, isSel, isBad) {
  const k = S.view.k;
  const r = Math.max(9, 0.45 * k);
  const [x, y] = pt(at.x, at.z);
  ctx.fillStyle = isBad ? "#5a1b22" : it.shoots !== "off" ? "#ff4655" : "#e0646f";
  ctx.strokeStyle = isSel ? "#fff" : isBad ? COLORS.bad : "#0a1118";
  ctx.lineWidth = isSel ? 3 : 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (it.shoots !== "off") {
    ctx.strokeStyle = "#ffb547"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
  }
  // Faces you
  const w = dirOf(facingOf(it, at));
  const [fx, fy] = turn(w.x, w.z, turns());
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + fx * r * 0.35, y + fy * r * 0.35); ctx.lineTo(x + fx * r * 0.95, y + fy * r * 0.95); ctx.stroke();
  // A fixed direction gets a line you can grab to turn the bot.
  if (fixedFacing(it) && isSel && !S.preview) {
    const tip = { x: at.x + w.x * 2.2, z: at.z + w.z * 2.2 };
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x + fx * r, y + fy * r); ctx.lineTo(...pt(tip.x, tip.z)); ctx.stroke();
    ctx.setLineDash([]);
    handle(tip.x, tip.z, "#fff");
  }
  if (it.crouch) { ctx.fillStyle = "#fff"; ctx.font = `700 ${Math.max(8, r * 0.6)}px Bahnschrift, Segoe UI`; ctx.textAlign = "center"; ctx.fillText("c", x, y + r * 0.2); }
}
// A structure's local point (lx: left-right, lz: back-front) in world x/z.
function blockToWorld(b, lx, lz) {
  const a = ((b.turn || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}
function blockHit(b, x, z) {
  const a = ((b.turn || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = x - b.x, dz = z - b.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  if (b.shape === "pillar") return Math.hypot(lx, lz) <= Math.max(b.w / 2, 0.4);
  return Math.abs(lx) <= Math.max(b.w / 2, 0.3) && Math.abs(lz) <= Math.max(b.d / 2, 0.3);
}
// Top-down look of a structure: its footprint, plus which way ramps and stairs go up,
// window and door gaps, and the open side of rooms.
function drawBlock(b, isSel, isBad) {
  const hw = b.w / 2, hd = b.d / 2;
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => pt(...Object.values(blockToWorld(b, lx, lz))));
  const path = () => { ctx.beginPath(); corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  ctx.globalAlpha = b.shape === "floor" ? 0.75 : 0.9;
  ctx.fillStyle = b.color || "#6b7280";
  if (b.shape === "pillar") { ctx.beginPath(); ctx.arc(...pt(b.x, b.z), (b.w / 2) * S.view.k, 0, Math.PI * 2); ctx.fill(); }
  else if (b.shape !== "room") { path(); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = isBad ? COLORS.bad : isSel ? "#fff" : "rgba(10,17,24,.9)";
  ctx.lineWidth = isSel ? 2.5 : 1.5;
  if (b.shape === "pillar") { ctx.beginPath(); ctx.arc(...pt(b.x, b.z), (b.w / 2) * S.view.k, 0, Math.PI * 2); ctx.stroke(); }
  else { path(); ctx.stroke(); }
  const L = (lx1, lz1, lx2, lz2) => { const p = blockToWorld(b, lx1, lz1), q = blockToWorld(b, lx2, lz2); line(p.x, p.z, q.x, q.z); };
  if (b.shape === "ramp" || b.shape === "stairs") {
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.5;
    if (b.shape === "stairs") { const n = Math.max(2, Math.round(b.h / 0.25)); for (let i = 1; i < n; i++) L(-hw, -hd + (b.d * i) / n, hw, -hd + (b.d * i) / n); }
    // arrow up the slope
    ctx.lineWidth = 2.5; L(0, -hd * 0.7, 0, hd * 0.7);
    const tip = blockToWorld(b, 0, hd * 0.75);
    arrow(blockToWorld(b, 0, hd * 0.2), tip, "#fff");
  }
  if (b.shape === "window" || b.shape === "door") {
    const g = b.shape === "window" ? Math.min(3, b.w * 0.8) / 2 : Math.min(1.4, b.w * 0.8) / 2;
    ctx.strokeStyle = b.shape === "window" ? "#7fd8ff" : "#0a1118"; ctx.lineWidth = Math.max(3, b.d * S.view.k);
    L(-g, 0, g, 0);
  }
  if (b.shape === "room") {
    ctx.strokeStyle = b.color || "#6b7280"; ctx.lineWidth = Math.max(4, 0.3 * S.view.k);
    const sides = { back: [-hw, -hd, hw, -hd], right: [hw, -hd, hw, hd], front: [hw, hd, -hw, hd], left: [-hw, hd, -hw, -hd] };
    for (const [side, seg4] of Object.entries(sides)) if (side !== b.open) L(...seg4);
    if (isSel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; path(); ctx.stroke(); }
  }
  if (b.lift > 0.05) {
    const [x, y] = pt(b.x, b.z);
    ctx.fillStyle = "#fff"; ctx.font = "700 11px Bahnschrift, Segoe UI"; ctx.textAlign = "center";
    ctx.fillText(`${(b.lift + b.h).toFixed(1)} m up`, x, y + 4);
  }
  label(b, b, Math.max(hd, hw) * S.view.k * 0.6 + 12, isSel);
}

function line(x1, z1, x2, z2) {
  ctx.beginPath(); ctx.moveTo(...pt(x1, z1)); ctx.lineTo(...pt(x2, z2)); ctx.stroke();
}
function handle(x, z, color, text) {
  const [px, py] = pt(x, z);
  ctx.fillStyle = color; ctx.strokeStyle = "#0a1118"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(px, py, text ? 8 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (text) { ctx.fillStyle = "#0a1118"; ctx.font = "800 10px Bahnschrift, Segoe UI"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, px, py + 0.5); ctx.textBaseline = "alphabetic"; }
}
function arrow(from, to, color) {
  const [ax, ay] = pt(from.x, from.z);
  const [x, y] = pt(to.x, to.z);
  const a = Math.atan2(y - ay, x - ax);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9 * Math.cos(a - 0.45), y - 9 * Math.sin(a - 0.45)); ctx.lineTo(x - 9 * Math.cos(a + 0.45), y - 9 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
// Name tag `lift` pixels above world point `at`.
function label(it, at, lift, strong) {
  if (S.view.k < 5 && !strong) return;
  const [x, py] = pt(at.x, at.z);
  const y = py - lift;
  const text = itemName(S.drill, it) + (it.kind === "bot" && it.shoots !== "off" ? " · shoots" : "");
  ctx.font = `${strong ? 700 : 600} 12px Bahnschrift, Segoe UI`;
  ctx.textAlign = "center";
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = strong ? "rgba(255,255,255,.95)" : "rgba(10,17,24,.75)";
  ctx.fillRect(x - w / 2, y - 13, w, 17);
  ctx.fillStyle = strong ? "#0a1118" : "#e6e9ec";
  ctx.fillText(text, x, y);
}
function ghost() {
  const x = pointer.x, y = pointer.y;
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = S.tool.kind === "bot" ? COLORS.bot : S.tool.kind === "targets" ? COLORS.target : S.tool.kind === "start" ? COLORS.start : "#b8c0c8";
  ctx.beginPath(); ctx.arc(x, y, Math.max(9, 0.45 * S.view.k), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function updateHint() {
  if (!hintEl) return;
  let html;
  const it = selItem();
  if (S.tool) {
    const name = S.tool.kind === "bot" ? MOVES[S.tool.move].short : S.tool.kind === "block" ? BLOCK_SHAPES[S.tool.move].label.toLowerCase() : { targets: "target zone", wall: "wall", barrier: "invisible wall", smoke: "smoke", start: "your start" }[S.tool.kind];
    html = `Click the map to place <b>${name}</b> · Shift-click to place more · <span class="kbd">Esc</span> cancel`;
  } else if (S.addPoint && it) {
    html = `Click the map to add route points to <b>${itemName(S.drill, it)}</b> · <span class="kbd">Esc</span> when done`;
  } else if (it && it.route) {
    html = "Drag the numbered points to shape the route · right-click a point to remove it";
  } else if (it) {
    html = "Drag to move · <span class=\"kbd\">Del</span> remove · <span class=\"kbd\">Ctrl</span>+<span class=\"kbd\">D</span> copy";
  } else if (S.sel === "start") {
    html = "Drag to move · drag the green dot to turn where you look";
  } else {
    html = S.mode3d
      ? "Pick something on the left, then click in the world · drag empty space to turn the camera · right-drag to move it · scroll to zoom"
      : "Pick a bot on the left, then click the map · scroll to zoom · drag empty space to move around";
  }
  if (hintEl.dataset.html !== html) { hintEl.dataset.html = html; hintEl.innerHTML = html; }
  stage.classList.toggle("placing", !!S.tool || S.addPoint);
  const empty = !S.drill.items.length && !S.tool;
  let coach = stage.querySelector(".empty-coach");
  if (empty && !coach) stage.append(h("div", { class: "empty-coach" }, h("b", {}, "Nothing here yet"), h("span", {}, "Pick a bot on the left (try a Strafer), then click on the map where it should stand.")));
  if (!empty && coach) coach.remove();
}

// ---------- mouse ----------
const pointer = { x: 0, y: 0, inside: false };
let drag = null;

function hitTest(px, py) {
  const d = S.drill;
  const near = (x, z, r = 11) => { const [qx, qy] = pt(x, z); return Math.hypot(qx - px, qy - py) <= r; };
  const it = selItem();
  // handles of the selected thing first
  const st = d.start, look = dirOf(st.facing);
  if (near(st.x + look.x * 4, st.z + look.z * 4, 10)) return { type: "turn" };
  if (it) {
    if (fixedFacing(it)) {
      const f = dirOf(it.facing);
      if (near(it.x + f.x * 2.2, it.z + f.z * 2.2, 10)) return { type: "botTurn", item: it };
    }
    const star = it.flash && it.flash.on ? flashTarget(it, d.start) : null;
    if (star && near(star.x, star.z, 12)) return { type: "flash", item: it };
    if (it.route) for (let i = it.route.length - 1; i >= 0; i--) if (near(it.route[i].x, it.route[i].z, 10)) return { type: "point", item: it, index: i };
    if (it.move === "strafe" || it.kind === "targets") {
      const a = across(it), half = it.width / 2;
      for (const s of [-1, 1]) if (near(it.x + a.x * half * s, it.z + a.z * half * s, 10)) return { type: "width", item: it };
    }
    if (it.kind === "wall") {
      const ends = wallEnds(it);
      for (let i = 0; i < 2; i++) if (near(ends[i].x, ends[i].z, 10)) return { type: "wallEnd", item: it, end: i };
    }
  }
  const r = Math.max(10, 0.45 * S.view.k + 2);
  if (near(st.x, st.z, Math.max(14, r))) return { type: "start" };
  const items = [...d.items].reverse();
  for (const i of items) if (i.kind === "bot" && near(i.x, i.z, r)) return { type: "item", item: i };
  for (const i of items) if (i.kind === "targets" && near(i.x, i.z, 14)) return { type: "item", item: i };
  for (const i of items) if (i.kind === "bot" && i.route) for (let n = 1; n < i.route.length; n++) if (near(i.route[n].x, i.route[n].z, 7)) return { type: "item", item: i };
  for (const i of items) if (i.kind === "wall") {
    const [a, b] = wallEnds(i);
    if (segDist(px, py, ...pt(a.x, a.z), ...pt(b.x, b.z)) < Math.max(8, 0.2 * S.view.k)) return { type: "item", item: i };
  }
  for (const i of items) if (i.kind === "smoke" && near(i.x, i.z, Math.max(12, 4.5 * S.view.k))) return { type: "item", item: i };
  // Structures: the highest one under the pointer.
  const at = toWorld(px, py);
  const blocks = items.filter((i) => i.kind === "block" && blockHit(i, at.x, at.z)).sort((a, b) => (b.y + b.lift + b.h) - (a.y + a.lift + a.h));
  if (blocks.length) return { type: "item", item: blocks[0] };
  return null;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function bindCanvas() {
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.inside = true;
    if (drag) dragMove(e);
    else canvas.style.cursor = S.tool || S.addPoint ? "" : hitTest(pointer.x, pointer.y) ? "grab" : "";
    if (S.tool || drag) draw();
  });
  canvas.addEventListener("pointerleave", () => { pointer.inside = false; draw(); });
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const at = toWorld(px, py);
    if (e.button === 2) {
      const hit = hitTest(px, py);
      if (hit && hit.type === "point") removePoint(hit.item, hit.index);
      else drag = { type: "pan", px, py, cx: S.view.cx, cz: S.view.cz };
      return;
    }
    if (e.button !== 0) return;
    if (S.tool) { place(S.tool, at); if (!e.shiftKey) setTool(null); return; }
    const it = selItem();
    if (S.addPoint && it && it.route) { addPoint(it, at); return; }
    const hit = hitTest(px, py);
    if (!hit) {
      if (S.sel !== null) { S.sel = null; S.addPoint = false; renderSide(); }
      drag = { type: "pan", px, py, cx: S.view.cx, cz: S.view.cz };
      stage.classList.add("panning");
      draw();
      return;
    }
    const target = hit.item ? hit.item.id : hit.type === "start" || hit.type === "turn" ? "start" : S.sel;
    if (target !== S.sel) { S.sel = target; S.addPoint = false; renderSide(); }
    const obj = hit.item || S.drill.start;
    drag = { ...hit, key: `drag-${Date.now()}`, dx: obj.x - at.x, dz: obj.z - at.z, moved: false };
    draw();
  });
  const end = () => {
    if (drag && drag.moved) renderSide();
    drag = null;
    stage.classList.remove("panning");
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
}

// at3: the world point under the mouse in 3D (2D works it out from the pointer).
function dragMove(e, at3) {
  const px = pointer.x, py = pointer.y;
  if (drag.type === "pan") {
    const [dx, dz] = turn((px - drag.px) / S.view.k, (py - drag.py) / S.view.k, (4 - turns()) % 4);
    S.view.cx = drag.cx - dx;
    S.view.cz = drag.cz - dz;
    return;
  }
  const at = at3 || toWorld(px, py);
  drag.moved = true;
  const snap = (v) => (e.altKey ? v : Math.round(v * 10) / 10);
  edit((d) => {
    if (drag.type === "turn") {
      d.start.facing = Math.round(yawDeg(d.start, at));
    } else if (drag.type === "start") {
      d.start.x = snap(at.x + drag.dx); d.start.z = snap(at.z + drag.dz);
      d.start.y = floorAt(d.start.x, d.start.z, at.y ?? d.start.y) ?? d.start.y;
    } else if (drag.type === "item") {
      const it = d.items.find((i) => i.id === drag.item.id);
      const nx = snap(at.x + drag.dx), nz = snap(at.z + drag.dz);
      const ox = nx - it.x, oz = nz - it.z;
      it.x = nx; it.z = nz;
      // In 3D, at.y is the surface under the mouse: the level you dragged onto.
      it.y = floorAt(it.x, it.z, at.y ?? it.y, it.kind === "block" ? it.id : undefined) ?? it.y;
      if (it.route) for (const p of it.route) { p.x = snap(p.x + ox); p.z = snap(p.z + oz); p.y = floorAt(p.x, p.z, p.y) ?? p.y; }
      if (it.flash && it.flash.target) it.flash.target = { x: snap(it.flash.target.x + ox), z: snap(it.flash.target.z + oz) };
    } else if (drag.type === "botTurn") {
      const it = d.items.find((i) => i.id === drag.item.id);
      it.facing = Math.round(yawDeg(it, at));
    } else if (drag.type === "flash") {
      const it = d.items.find((i) => i.id === drag.item.id);
      it.flash.target = { x: snap(at.x), z: snap(at.z) };
    } else if (drag.type === "point") {
      const it = d.items.find((i) => i.id === drag.item.id);
      const p = it.route[drag.index];
      p.x = snap(at.x); p.z = snap(at.z);
      p.y = floorAt(p.x, p.z, at.y ?? p.y) ?? p.y;
      if (drag.index === 0) { it.x = p.x; it.y = p.y; it.z = p.z; }
    } else if (drag.type === "width") {
      const it = d.items.find((i) => i.id === drag.item.id);
      const a = across(it);
      const w = Math.abs((at.x - it.x) * a.x + (at.z - it.z) * a.z) * 2;
      it.width = Math.round(Math.max(it.kind === "targets" ? 0 : 0.4, Math.min(it.kind === "targets" ? 30 : 12, w)) * 10) / 10;
    } else if (drag.type === "wallEnd") {
      const it = d.items.find((i) => i.id === drag.item.id);
      const other = wallEnds(it)[1 - drag.end];
      const len = Math.max(0.5, dist(other, at));
      const ang = Math.atan2(-(at.z - other.z), at.x - other.x) * (180 / Math.PI) + (drag.end === 0 ? 180 : 0);
      it.length = Math.round(len * 10) / 10;
      it.turn = Math.round(((ang % 360) + 360) % 360);
      const ends = wallEnds({ ...it, x: 0, z: 0 });
      const fixed = ends[1 - drag.end];
      it.x = Math.round((other.x - fixed.x) * 100) / 100; it.z = Math.round((other.z - fixed.z) * 100) / 100;
      it.y = floorAt(it.x, it.z, it.y) ?? it.y;
    }
  }, { key: drag.key, quiet: true });
}

// Tray: click a card to place it with the next map click, or drag it straight onto the map.
function trayDown(e, tool) {
  if (e.button !== 0) return;
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  let moved = false;
  const wasOn = S.tool && S.tool.kind === tool.kind && S.tool.move === tool.move;
  setTool(tool);
  const move = (ev) => {
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) moved = true;
    const r = canvas.getBoundingClientRect();
    pointer.x = ev.clientX - r.left; pointer.y = ev.clientY - r.top;
    pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= r.width && pointer.y <= r.height;
    draw();
  };
  const up = (ev) => {
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    if (!moved) { if (wasOn) setTool(null); return; } // a click: place with the next map click (a second click cancels)
    const r = canvas.getBoundingClientRect();
    if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
      place(tool, toWorld(ev.clientX - r.left, ev.clientY - r.top));
    }
    setTool(null);
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
}

function setTool(tool) {
  S.tool = tool;
  S.addPoint = false;
  for (const b of document.querySelectorAll(".tool")) b.classList.toggle("on", !!tool && b.dataset.tool === (tool.move || tool.kind));
  draw();
}

function place(tool, at) {
  const snapped = { x: Math.round(at.x * 10) / 10, z: Math.round(at.z * 10) / 10 };
  const y = floorAt(snapped.x, snapped.z, at.y ?? S.drill.start.y);
  if (onMap() && S.map && y === null) { toast("That spot is outside the map. Click on a floor."); return; }
  const p = { ...snapped, y: y ?? 0 };
  if (tool.kind === "start") {
    edit((d) => Object.assign(d.start, p));
    S.sel = "start";
    renderSide();
    return;
  }
  let item;
  if (tool.kind === "bot") {
    item = newBot(tool.move, p);
    // Routes start beside the click, across your view, and on the floor.
    if (item.route) {
      const a = across(item);
      const offsets = { peek: [[-2, 0], [0, 0]], cross: [[-4, 0], [4, 0]], patrol: [[0, 0], [0, 5]] }[tool.move];
      const back = dirOf(yawDeg(p, S.drill.start));
      item.route = offsets.map(([s, f], i) => {
        const x = Math.round((p.x + a.x * s - back.x * f) * 10) / 10, z = Math.round((p.z + a.z * s - back.z * f) * 10) / 10;
        return { x, z, y: floorAt(x, z, p.y) ?? p.y, wait: tool.move === "patrol" && i === 1 ? 1 : 0 };
      });
      Object.assign(item, { x: item.route[0].x, y: item.route[0].y, z: item.route[0].z });
    }
  } else if (tool.kind === "targets") item = newTargets(p);
  else if (tool.kind === "wall" || tool.kind === "barrier") {
    item = tool.kind === "barrier" ? newBarrier(p) : newWall(p);
    // Walls start square to your view.
    const f = yawDeg(p, S.drill.start);
    item.turn = Math.round(f) % 180;
  } else if (tool.kind === "block") {
    item = newBlock(tool.move, p);
    // Front (the high end of ramps and stairs, the face of walls) points at your start.
    item.turn = Math.round((yawDeg(p, S.drill.start) + 180) % 360);
  } else if (tool.kind === "smoke") item = newSmoke(p);
  edit((d) => d.items.push(item));
  S.sel = item.id;
  renderSide();
}

function addPoint(it, at) {
  const x = Math.round(at.x * 10) / 10, z = Math.round(at.z * 10) / 10;
  const last = it.route[it.route.length - 1];
  const y = floorAt(x, z, at.y ?? last.y);
  if (onMap() && S.map && y === null) { toast("That spot is outside the map. Click on a floor."); return; }
  if (it.move === "peek" && it.route.length >= 2) { toast("A peek has 2 points: cover and the peek spot. Drag them instead."); return; }
  edit((d) => d.items.find((i) => i.id === it.id).route.push({ x, z, y: y ?? 0, wait: 0 }));
}
function removePoint(it, index) {
  if (it.route.length <= 2) { toast("A route needs at least 2 points."); return; }
  edit((d) => {
    const bot = d.items.find((i) => i.id === it.id);
    bot.route.splice(index, 1);
    Object.assign(bot, { x: bot.route[0].x, y: bot.route[0].y, z: bot.route[0].z });
  });
}

// ---------- keyboard ----------
addEventListener("keydown", (e) => {
  if (S.screen !== "editor" || document.querySelector(".scrim, .coach")) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) && document.activeElement.type !== "range";
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveCurrent(); return; }
  if (typing) return;
  if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); }
  else if (e.key === "Delete" || e.key === "Backspace") { if (selItem()) { e.preventDefault(); removeSelected(); } }
  else if (e.key === "Escape") {
    if (S.tool) setTool(null);
    else if (S.addPoint) { S.addPoint = false; renderSide(); draw(); }
    else if (S.sel) { S.sel = null; renderSide(); draw(); }
  }
});

function duplicate() {
  const it = selItem();
  if (!it) return;
  const copy = JSON.parse(JSON.stringify(it));
  copy.id = `${it.kind}-${Date.now().toString(36)}`;
  const a = it.kind === "wall" ? { x: 0, z: 1 } : across(it);
  const shift = (o) => { o.x = Math.round((o.x + a.x * 1.5) * 10) / 10; o.z = Math.round((o.z + a.z * 1.5) * 10) / 10; o.y = floorAt(o.x, o.z, o.y) ?? o.y; };
  shift(copy);
  if (copy.route) copy.route.forEach(shift);
  if (copy.flash && copy.flash.target) shift(copy.flash.target);
  edit((d) => d.items.push(copy));
  S.sel = copy.id;
  renderSide();
}
function removeSelected() {
  const it = selItem();
  if (!it) return;
  edit((d) => (d.items = d.items.filter((i) => i.id !== it.id)));
  S.sel = null;
  S.addPoint = false;
  renderSide();
}

// ---------- the settings panel ----------
function field(label, control, help) {
  return h("div", { class: "field" }, label ? h("label", {}, label) : null, control, help ? h("p", { class: "help" }, help) : null);
}
function seg(options, value, pick) {
  return h("div", { class: "seg", role: "radiogroup" }, options.map(([v, label, title]) =>
    h("button", { class: v === value ? "on" : "", role: "radio", "aria-checked": String(v === value), title: title || null, onclick: () => pick(v) }, label)));
}
// Slider with a live readout. Changes while dragging are one undo step.
function slider(min, max, step, value, fmt, set) {
  const out = h("output", {}, fmt(value));
  const key = `slider-${Math.random()}`;
  const input = h("input", {
    type: "range", min, max, step, value,
    oninput: (e) => { const v = +e.target.value; out.textContent = fmt(v); edit((d) => set(d, v), { key, quiet: true }); },
    onchange: () => renderSide(),
  });
  return h("div", { class: "slider" }, input, out);
}
function toggle(on, title, sub, set) {
  return h("button", { class: "switch" + (on ? " on" : ""), role: "switch", "aria-checked": String(on), onclick: () => edit((d) => set(d, !on)) },
    h("span", {}, title, sub ? h("small", {}, sub) : null), h("i"));
}
const secs = (v) => (v === 0 ? "0 s" : `${v.toFixed(v < 10 ? 1 : 0)} s`);
const metres = (v) => `${v.toFixed(1)} m`;
const mod = (fn) => (d) => { const it = d.items.find((i) => i.id === S.sel); if (it) fn(it, d); };

function renderSide() {
  if (!side || !S.drill) return;
  const scroll = side.scrollTop;
  side.textContent = "";
  const it = selItem();
  const parts = S.sel === "start" ? startPanel()
    : !it ? drillPanel()
    : it.kind === "bot" ? botPanel(it)
    : it.kind === "targets" ? targetsPanel(it)
    : it.kind === "wall" ? wallPanel(it)
    : it.kind === "block" ? blockPanel(it)
    : smokePanel(it);
  side.append(...parts.filter(Boolean));
  side.scrollTop = scroll;
  updateHint();
}

function head(iconName, cls, title, sub) {
  return [h("div", { class: "insp-head" }, ic(iconName, cls), h("h3", {}, title)), sub ? h("p", { class: "insp-sub" }, sub) : null];
}

function checksBox() {
  const list = problems(S.drill, floorCheck());
  if (!list.length) return h("div", { class: "checks ok" }, "Ready to play.");
  const hard = list.filter((p) => !p.soft).length;
  return h("div", { class: "checks" + (hard ? " bad" : "") },
    h("b", {}, hard ? "Fix before playing" : "Good to go, but:"),
    h("ul", {}, list.map((p) => h("li", { class: p.soft ? "soft" : "" }, p.text, " ",
      p.id ? h("button", { class: "link", onclick: () => { S.sel = p.id; renderSide(); draw(); focusOn(p.id); } }, "Show") : null))));
}
function focusOn(id) {
  const o = id === "start" ? S.drill.start : S.drill.items.find((i) => i.id === id);
  if (!o) return;
  S.view.cx = o.x; S.view.cz = o.z;
  if (view3d) view3d.focus(o.x, o.y || 0, o.z);
  draw();
}

// Which bots shoot at you, in one place, with a one-click "nobody shoots".
function shootersBox() {
  const d = S.drill;
  const shooters = d.items.filter((i) => i.kind === "bot" && i.shoots !== "off");
  if (!shooters.length) return h("div", { class: "group" }, h("label", {}, "Bots shooting at you"), h("p", { class: "help" }, "None. No bot in this drill shoots."));
  return h("div", { class: "group" },
    h("label", {}, `Bots shooting at you (${shooters.length})`),
    h("div", { class: "shooters" }, shooters.map((b) => h("button", {
      class: "btn small", title: "Show this bot", onclick: () => { S.sel = b.id; renderSide(); focusOn(b.id); },
    }, itemName(d, b), h("span", { class: "muted" }, ` · ${RANKS.find((r) => r[0] === b.shoots)[1]}`)))),
    h("p", { class: "help" }, d.round.die
      ? "Their hits hurt, and if you die the round ends."
      : "Their hits take health and slow you down (like getting tagged in the game), but you can't die. Turn on \"Bots can kill me\" below for real fights."),
    h("button", { class: "btn small", onclick: () => edit((dd) => dd.items.forEach((i) => { if (i.kind === "bot") i.shoots = "off"; })) }, "Make every bot stop shooting"));
}

function drillPanel() {
  const d = S.drill, r = d.round;
  const set = (fn) => (v) => edit((dd) => fn(dd.round, v));
  const bots = d.items.filter((i) => i.kind === "bot").length;
  const oneByOne = r.order !== "together";
  return [
    ...head("gear", "", "Drill settings", "Click anything on the map to change it. These settings are for the whole drill."),
    checksBox(),
    shootersBox(),
    h("div", { class: "group" },
      field("Goal", seg([["score", "Score kills", "Kill as many as you can before time runs out"], ["clear", "Clear them all", "Kill every bot as fast as you can"], ["track", "Tracking", "Keep your crosshair on the target"]], r.goal, set((o, v) => (o.goal = v))),
        { score: "Kill as many as you can before the time runs out.", clear: "Every bot appears once. Kill them all as fast as you can; your time is scored.", track: "Hold fire on the target. Score is how long you stay on it. Targets can't die." }[r.goal]),
      field(r.goal === "clear" ? "Time limit" : "Round length", h("div", {},
        seg([[30, "30 s"], [60, "1 min"], [90, "1:30"], [120, "2 min"]], r.time, set((o, v) => (o.time = v))),
        slider(10, 300, 5, r.time, (v) => (v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}` : `${v} s`), (dd, v) => (dd.round.time = v)))),
      r.goal === "clear" ? field("Good time (3 stars)", slider(0, 120, 1, r.par || 0, (v) => (v ? `${v} s` : "Auto"), (dd, v) => (dd.round.par = v)), "Beat this time for the best rating. Auto: about 2.5 s per bot.") : null),
    h("div", { class: "group" },
      h("label", {}, "Your weapon"), weaponGrid(r.weapon, false, set((o, v) => (o.weapon = v))),
      r.goal === "track" ? null : field("Firing", seg([[true, "Full auto (hold to spray)"], [false, "One shot per click"]], r.auto !== false, set((o, v) => (o.auto = v))),
        "Full auto works like in the game: hold the button and rifles keep firing.")),
    h("div", { class: "group" },
      h("label", {}, "You"),
      field(null, toggle(r.move, "I can walk around", "Off: you stay on your start spot and only aim.", (dd, v) => (dd.round.move = v))),
      field(null, toggle(r.die, "Bots can kill me", "If you die, the round ends.", (dd, v) => (dd.round.die = v))),
      field(null, toggle(r.ammo, "Real magazine and reloads", "Off: endless ammo.", (dd, v) => (dd.round.ammo = v)))),
    r.goal !== "track" && bots ? h("div", { class: "group" },
      field("Bots show up", seg([["together", "All at once"], ["random", "One by one, random"], ["inOrder", "One by one, in order"]], r.order, set((o, v) => (o.order = v))),
        oneByOne ? "On its turn each bot does its thing once (a peeker peeks once). Rushers without a flash walk all round." : null),
      oneByOne ? field("How many at a time", slider(1, 5, 1, r.atOnce || 1, (v) => `${v}`, (dd, v) => (dd.round.atOnce = v))) : null,
      oneByOne ? field("Pause before the next one", slider(0, 5, 0.1, r.gap ?? 1, secs, (dd, v) => (dd.round.gap = v))) : null) : null,
    h("div", { class: "group" },
      h("label", {}, "Place"),
      onMap()
        ? h("p", { class: "help" }, `${mapLabel(d.place)}. To use another map, make a new drill.`)
        : field(null, seg([["small", "Small"], ["medium", "Medium"], ["large", "Large"]], d.rangeSize, (v) => { edit((dd) => (dd.rangeSize = v)); fitView(); draw(); }), "Size of the range floor.")),
    h("div", { class: "group" },
      field("Description", h("textarea", { class: "text", maxlength: 300, placeholder: "Shown on the card in the lobby.", oninput: (e) => edit((dd) => (dd.note = e.target.value), { key: "note", quiet: true }) }, d.note || ""))),
  ];
}

function floorPicker(o, apply) {
  if (onMap() && !S.map) return null;
  const levels = levelsHere(o.x, o.z, o.kind === "block" ? o.id : undefined);
  if (levels.length < 2) return null;
  const names = levels.map((y, i) => [y, i === 0 ? "Lowest" : i === levels.length - 1 ? "Highest" : `Level ${i + 1}`, `${y.toFixed(1)} m`]);
  const cur = levels.reduce((b, y) => (Math.abs(y - o.y) < Math.abs(b - o.y) ? y : b), levels[0]);
  return field("Floor", seg(names.map(([y, n, t]) => [y, n, t]), cur, (y) => edit((d) => apply(d, y))), "There is more than one floor here (stairs, boxes or roofs). Pick the one to stand on.");
}

function startPanel() {
  const st = S.drill.start;
  const bots = S.drill.items.filter((i) => i.kind === "bot" || i.kind === "targets");
  const nearest = bots.sort((a, b) => dist(a, st) - dist(b, st))[0];
  return [
    ...head("you", "", "Your start", "Where you stand when the round starts and where you look."),
    h("div", { class: "group" },
      field("Looking toward", slider(0, 359, 1, Math.round(st.facing), (v) => `${v}°`, (d, v) => (d.start.facing = v)), "Or drag the green dot in front of you on the map."),
      nearest ? h("button", { class: "btn small", onclick: () => edit((d) => (d.start.facing = Math.round(yawDeg(d.start, nearest)))) }, "Face ", itemName(S.drill, nearest)) : null),
    h("div", { class: "group" }, field(null, toggle(S.drill.round.move, "I can walk around", "Off: you stay here and only aim.", (d, v) => (d.round.move = v)))),
    floorPicker(st, (d, y) => (d.start.y = y)),
  ];
}

function botPanel(b) {
  const m = MOVES[b.move];
  const d = S.drill;
  const clear = d.round.goal === "clear";
  const fromYou = dist(b, d.start);
  const set = (fn) => (v) => edit(mod((it) => fn(it, v)));
  const out = [
    ...head(b.move, "ic-bot", itemName(d, b), m.tip),
    h("div", { class: "stat" }, h("span", {}, h("b", {}, `${fromYou.toFixed(0)} m`), " from you"),
      b.shoots !== "off" ? h("span", {}, "Shoots: ", h("b", {}, RANKS.find((r) => r[0] === b.shoots)[1])) : null),
    h("div", { class: "group" },
      field("What it does", seg(Object.entries(MOVES).map(([k, v]) => [k, v.short, v.label]), b.move, (v) => changeMove(b, v)))),
  ];
  const moveGroup = h("div", { class: "group" });
  const speed = field("Speed", seg([["walk", "Walk"], ["run", "Run"]], b.speed, set((it, v) => (it.speed = v))));
  if (b.move === "strafe") {
    moveGroup.append(
      field("How wide", slider(0.4, 12, 0.1, b.width, metres, (dd, v) => mod((it) => (it.width = v))(dd)), "Or drag the orange end dots on the map."),
      speed);
  } else if (b.move === "peek") {
    moveGroup.append(...[
      field("At the peek", seg([[true, "Strafes A-D"], [false, "Holds still"]], !!b.peekStrafe, set((it, v) => (it.peekStrafe = v)))),
      field("Time out in the open", slider(0.3, 5, 0.1, b.wait, secs, (dd, v) => mod((it) => (it.wait = v))(dd)), "Then it walks back behind cover."),
      b.flash && b.flash.on || takingTurns() ? null : field("Time behind cover", slider(0.2, 5, 0.1, b.coverWait ?? 1, secs, (dd, v) => mod((it) => (it.coverWait = v))(dd)), "Before it peeks again."),
      speed,
      h("p", { class: "help" }, "On the map: point 1 (green) is cover, point 2 is the peek spot. Drag them. Put a wall between point 1 and you."),
    ].filter(Boolean));
  } else if (b.move === "cross" || b.move === "patrol") {
    moveGroup.append(speed, field(b.move === "cross" || (b.flash && b.flash.on) ? "Route (appears at 1, disappears at the last point)" : "Route (loops back to 1)", routeList(b)));
  } else {
    moveGroup.append(h("p", { class: "help" }, "Stands on its spot, facing your start."));
  }
  if (b.move === "still" || b.move === "strafe") {
    moveGroup.append(field("Pose", seg([[false, "Standing"], [true, "Crouching"]], b.crouch, set((it, v) => (it.crouch = v)))));
    const fixed = typeof b.facing === "number";
    moveGroup.append(field("Faces", seg([[false, "Always faces you"], [true, "A direction I pick"]], fixed,
      (v) => edit(mod((it) => (it.facing = v ? Math.round(yawDeg(it, S.drill.start)) : null)))),
    fixed ? "Drag the white dot in front of the bot on the map, or use the slider. It strafes along its own left and right." : "It turns to keep facing you."));
    if (fixed) moveGroup.append(slider(0, 359, 1, b.facing, (v) => `${v}°`, (dd, v) => mod((it) => (it.facing = v))(dd)));
  }
  out.push(moveGroup);
  if (b.route) out.push(flashGroup(b));

  out.push(h("div", { class: "group" },
    field("Shoots back", rankGrid(b.shoots, (v) => edit(mod((it) => { it.shoots = v; if (v !== "off" && !it.weapon) it.weapon = "vandal"; }))),
      b.shoots === "off" ? "Pick a rank and it shoots back like a player of that rank." : `Reacts in about ${RANKS.find((r) => r[0] === b.shoots)[2].reaction[0].toFixed(2)} s${RANKS.find((r) => r[0] === b.shoots)[2].heads ? " and goes for your head" : ""}.${d.round.die ? "" : " Turn on \"Bots can kill me\" in drill settings for real danger."}`)));

  out.push(h("div", { class: "group" },
    field("After a kill", clear ? h("p", { class: "help" }, "Stays dead (the goal is Clear them all).") :
      h("div", {}, seg([[true, "Comes back"], [false, "Stays dead"]], b.back, set((it, v) => (it.back = v))),
        b.back ? slider(0.2, 8, 0.1, b.backAfter, (v) => `after ${secs(v)}`, (dd, v) => mod((it) => (it.backAfter = v))(dd)) : null)),
    field("Toughness", seg(ARMOR.map(([v, l]) => [v, l.split(" (")[0], l]), b.hp, set((it, v) => (it.hp = v)))),
    d.round.order === "together" || b.move === "patrol" ? field("Shows up after", slider(0, 15, 0.1, b.delay || 0, secs, (dd, v) => mod((it) => (it.delay = v))(dd))) : null));

  out.push(h("div", { class: "group" },
    field("Looks like", lookGrid(b.look, set((it, v) => (it.look = v)))),
    field("Gun in hand", weaponGrid(b.weapon, true, set((it, v) => (it.weapon = v))), b.shoots !== "off" ? "It shoots with this gun's real fire rate." : null)));

  out.push(floorPicker(b, (dd, y) => mod((it) => {
    const dy = y - it.y;
    it.y = y;
    if (it.route) for (const p of it.route) p.y = Math.round((p.y + dy) * 100) / 100;
  })(dd)));
  out.push(actions());
  return out;
}

// Enemy flash: who throws it, from where, where it pops, how long the bot waits after.
function flashGroup(b) {
  const f = b.flash;
  const setF = (fn) => (v) => edit(mod((it) => fn(it.flash, v)));
  const box = h("div", { class: "group" },
    field("Flash", toggle(f.on, "Throws a flash first", { peek: "Stops at the edge of cover, throws, then swings out.", cross: "Stops on its route, throws, then keeps running.", patrol: "Stops on its route, throws, then keeps walking." }[b.move],
      (dd, v) => mod((it) => { it.flash.on = v; if (v && it.move === "cross") it.flash.at = Math.min(it.flash.at || 1, it.route.length - 1); })(dd))));
  if (!f.on) return box;
  const agent = FLASH_AGENTS.find((a) => a[0] === f.agent) || FLASH_AGENTS[0];
  box.append(field("Whose flash", seg(FLASH_AGENTS.map(([id, label]) => [id, label]), agent[0], setF((fl, v) => (fl.agent = v))), agent[2]));
  if (agent[3]) box.append(field("Throw", seg(agent[3], agent[3].some((c) => c[0] === f.curve) ? f.curve : agent[3][0][0], setF((fl, v) => (fl.curve = v)))));
  if (b.move !== "peek") {
    const choices = b.route.slice(1).map((_, i) => [i + 1, `Point ${i + 2}`]);
    box.append(field("Throws it from", seg(choices, Math.min(f.at || 1, b.route.length - 1), setF((fl, v) => (fl.at = v)))));
  }
  box.append(...[
    field("Pops at", seg([[1.2, "Low"], [2.2, "Head height"], [3.5, "High"]], f.height ?? 2.2, setF((fl, v) => (fl.height = v)))),
    field("Waits after throwing", slider(0.3, 2.5, 0.1, f.wait ?? 1, secs, (dd, v) => mod((it) => (it.flash.wait = v))(dd)), "0.7 to 1.8 s feels like a real player: shorter and it runs into its own flash."),
    h("div", {},
      h("p", { class: "help" }, "Drag the white star on the map to where the flash should pop. Press Preview moves to watch it."),
      f.target ? h("button", { class: "btn small", onclick: () => edit(mod((it) => (it.flash.target = null))) }, "Put the star back in front of the bot") : null),
    b.move === "patrol" ? h("p", { class: "help" }, "A Rusher that flashes walks its route once, disappears at the last point, then comes again.") : null,
    b.move === "peek" ? h("p", { class: "help" }, "A peeker that flashes disappears behind cover after each peek and comes again.") : null,
  ].filter(Boolean));
  return box;
}

function changeMove(b, move) {
  if (move === b.move) return;
  edit(mod((it) => {
    const fresh = newBot(move, { x: it.x, y: it.y, z: it.z });
    it.move = move;
    if (fresh.route) {
      const a = across(it);
      const pts = { peek: [[0, 0], [2, 0]], cross: [[0, 0], [8, 0]], patrol: [[0, 0], [0, 5]] }[move];
      const back = dirOf(yawDeg(it, S.drill.start));
      it.route = pts.map(([s, f], i) => {
        const x = Math.round((it.x + a.x * s - back.x * f) * 10) / 10, z = Math.round((it.z + a.z * s - back.z * f) * 10) / 10;
        return { x, z, y: floorAt(x, z, it.y) ?? it.y, wait: move === "patrol" && i === 1 ? 1 : 0 };
      });
    } else delete it.route;
  }));
  S.addPoint = false;
}

function routeList(b) {
  const box = h("div", { class: "points" });
  b.route.forEach((p, i) => {
    const last = i === b.route.length - 1;
    box.append(h("div", { class: "point" + (i === 0 ? " first" : last && b.move === "cross" ? " last" : "") },
      h("i", {}, String(i + 1)),
      slider(0, 6, 0.1, p.wait || 0, (v) => (v ? `wait ${v.toFixed(1)} s` : "no wait"), (dd, v) => mod((it) => (it.route[i].wait = v))(dd)),
      h("button", { class: "btn icon ghost", title: "Remove this point", "aria-label": `Remove point ${i + 1}`, disabled: b.route.length <= 2, onclick: () => removePoint(b, i) }, ic("trash"))));
  });
  box.append(h("button", {
    class: "btn small" + (S.addPoint ? " primary" : ""),
    onclick: () => { S.addPoint = !S.addPoint; S.tool = null; renderSide(); draw(); },
  }, ic("plus"), S.addPoint ? "Click the map… (Esc to stop)" : "Add points on the map"));
  return box;
}

function rankGrid(value, pick) {
  return h("div", { class: "ranks" }, RANKS.map(([id, label]) => h("button", { class: (id === "off" ? "off " : "") + (id === value ? "on" : ""), onclick: () => pick(id), title: label }, id === "off" ? "Doesn't shoot" : label)));
}
function lookGrid(value, pick) {
  return h("div", { class: "looks" }, LOOKS.map(([id, label]) => h("button", { class: id === value ? "on" : "", onclick: () => pick(id) }, label)));
}
function weaponGrid(value, allowNone, pick) {
  const list = allowNone ? [["", "None"], ...WEAPONS] : WEAPONS;
  return h("div", { class: "weapons" }, list.map(([id, label]) => h("button", { class: id === value ? "on" : "", title: label, onclick: () => pick(id) },
    id ? h("img", { src: `/local/equipment-icons/${id}.png`, alt: "" }) : h("span", { style: "height:18px;line-height:18px" }, "—"), label)));
}

function targetsPanel(t) {
  const set = (fn) => (v) => edit(mod((it) => fn(it, v)));
  return [
    ...head("targets", "ic-target", itemName(S.drill, t), "Floating targets pop up somewhere inside this area, facing you."),
    h("div", { class: "stat" }, h("span", {}, h("b", {}, `${dist(t, S.drill.start).toFixed(0)} m`), " from you")),
    h("div", { class: "group" },
      field("Target size", seg([["small", "Small"], ["medium", "Medium"], ["large", "Large"]], t.size, set((it, v) => (it.size = v)))),
      field("How many at once", slider(1, 6, 1, t.count, (v) => `${v}`, (dd, v) => mod((it) => (it.count = v))(dd))),
      field("Vanishes after", seg([[0, "Never"], [1.5, "1.5 s"], [1, "1 s"], [0.7, "0.7 s"]], t.vanish, set((it, v) => (it.vanish = v))), "A target that vanishes before you hit it counts as a miss."),
      field("Movement", seg([["still", "Still"], ["drift", "Drifts"], ["fast", "Darts"]], t.motion, set((it, v) => (it.motion = v))))),
    h("div", { class: "group" },
      field("Area width", slider(0, 30, 0.5, t.width, metres, (dd, v) => mod((it) => (it.width = v))(dd)), "Or drag the end dots on the map."),
      field("Area height", slider(0, 8, 0.1, t.height, metres, (dd, v) => mod((it) => (it.height = v))(dd))),
      field("Middle of the area above the floor", slider(0.3, 8, 0.1, t.lift, metres, (dd, v) => mod((it) => (it.lift = v))(dd)), "1.6 m is head height.")),
    h("div", { class: "group" }, field("Color", seg([["#2fe0c8", "Teal"], ["#ffb547", "Amber"], ["#ff4655", "Red"], ["#a974ff", "Purple"], ["#f2f4f5", "White"]], t.color, set((it, v) => (it.color = v))))),
    floorPicker(t, (dd, y) => mod((it) => (it.y = y))(dd)),
    actions(),
  ];
}

function wallPanel(w) {
  return [
    ...head(w.invisible ? "barrier" : "wall", w.invisible ? "ic-air" : "ic-gear", itemName(S.drill, w), w.invisible
      ? "Nobody can walk through it, you or the bots, but you can see and shoot through it. Use it to keep yourself inside the drill or out of the bots' spawn."
      : "Solid cover. Bullets and bots can't go through."),
    h("div", { class: "group" },
      field("Type", seg([[false, "Solid wall"], [true, "Invisible wall"]], !!w.invisible, (v) => edit(mod((it) => (it.invisible = v))))),
      field("Height", seg(w.invisible ? [[2, "2 m"], [4, "4 m (can't jump over)"], [8, "8 m"]] : [[1, "Crouch cover"], [1.5, "Chest"], [2.5, "Full"], [4, "Tall"]], w.height, (v) => edit(mod((it) => (it.height = v))))),
      field("Length", slider(0.5, 40, 0.1, w.length, metres, (dd, v) => mod((it) => (it.length = v))(dd)), "Or drag the end dots on the map."),
      field("Turn", slider(0, 179, 1, w.turn % 180, (v) => `${v}°`, (dd, v) => mod((it) => (it.turn = v))(dd))),
      h("button", { class: "btn small", onclick: () => edit(mod((it) => (it.turn = Math.round(yawDeg(it, S.drill.start)) % 180))) }, "Square to my view")),
    floorPicker(w, (dd, y) => mod((it) => (it.y = y))(dd)),
    actions(),
  ];
}

function blockPanel(b) {
  const s = BLOCK_SHAPES[b.shape];
  const num = (key, min, max, step, label, help) => field(label, slider(min, max, step, b[key], metres, (dd, v) => mod((it) => (it[key] = v))(dd)), help);
  const turnBy = (deg) => edit(mod((it) => (it.turn = (((it.turn || 0) + deg) % 360 + 360) % 360)));
  return [
    ...head(`b-${b.shape}`, "ic-gear", itemName(S.drill, b), s.tip),
    h("div", { class: "group" },
      field("Piece", seg(Object.entries(BLOCK_SHAPES).map(([k, v]) => [k, v.label]), b.shape, (v) => edit(mod((it) => {
        const n = BLOCK_SHAPES[v];
        Object.assign(it, { shape: v, w: n.w, d: n.d, h: n.h, lift: n.lift });
      }))))),
    h("div", { class: "group" },
      b.shape === "pillar"
        ? num("w", 0.3, 4, 0.1, "Thickness")
        : num("w", 0.5, 40, 0.1, b.shape === "window" || b.shape === "door" ? "Length" : "Width"),
      b.shape === "pillar" || b.shape === "window" || b.shape === "door" ? null : num("d", 0.5, 40, 0.1, b.shape === "ramp" || b.shape === "stairs" ? "Length (up the slope)" : "Depth"),
      num("h", b.shape === "floor" ? 0.1 : 0.3, 12, 0.1, b.shape === "ramp" || b.shape === "stairs" ? "How high it goes" : b.shape === "floor" ? "Thickness" : "Height"),
      b.shape === "floor" || b.shape === "box" ? num("lift", 0, 12, 0.1, "Raised off the floor", b.shape === "floor" ? "Match a ramp's or stairs' height so you can walk up onto it." : "0 sits on the floor.") : null,
      b.shape === "room" ? field("Open side", seg([["front", "Front"], ["back", "Back"], ["left", "Left"], ["right", "Right"], ["none", "None"]], b.open || "front", (v) => edit(mod((it) => (it.open = v))))) : null),
    h("div", { class: "group" },
      field("Turn", slider(0, 359, 1, b.turn || 0, (v) => `${v}°`, (dd, v) => mod((it) => (it.turn = v))(dd)),
        b.shape === "ramp" || b.shape === "stairs" ? "The white arrow on the map points up the slope." : null),
      h("div", { class: "danger-zone" },
        h("button", { class: "btn small", onclick: () => turnBy(-90) }, "↺ 90°"),
        h("button", { class: "btn small", onclick: () => turnBy(90) }, "↻ 90°"),
        h("button", { class: "btn small", onclick: () => edit(mod((it) => (it.turn = Math.round((yawDeg(it, S.drill.start) + 180) % 360)))) }, "Face me"))),
    h("div", { class: "group" }, field("Color", seg(BLOCK_COLORS, b.color, (v) => edit(mod((it) => (it.color = v)))))),
    floorPicker(b, (dd, y) => mod((it) => (it.y = y))(dd)),
    actions(),
  ];
}

function smokePanel(s) {
  return [
    ...head("smoke", "ic-gear", itemName(S.drill, s), "A smoke that blocks sight (not bullets). It lasts about as long as in the game."),
    h("div", { class: "group" },
      field("Whose smoke", seg(SMOKE_AGENTS, s.agent, (v) => edit(mod((it) => (it.agent = v))))),
      field("Pops at", slider(0, 60, 0.5, s.at, (v) => `${v.toFixed(1)} s`, (dd, v) => mod((it) => (it.at = v))(dd)), "Seconds after the round starts.")),
    floorPicker(s, (dd, y) => mod((it) => (it.y = y))(dd)),
    actions(),
  ];
}

function actions() {
  return h("div", { class: "group" }, h("div", { class: "danger-zone" },
    h("button", { class: "btn small", onclick: duplicate, title: "Ctrl+D" }, ic("copy"), "Copy"),
    h("button", { class: "btn small danger", onclick: removeSelected, title: "Delete" }, ic("trash"), "Delete")));
}

// ---------- first-time tour ----------
function maybeCoach() {
  try { if (localStorage.getItem(COACH_KEY)) return; } catch { return; }
  const steps = [
    ["tray", "Add things", "Click a bot (or a target zone, wall, smoke), then click the map. You can also drag it straight onto the map."],
    ["map", "Shape it", "Drag bots, route points and your start (green). Scroll to zoom, drag empty space to look around."],
    ["side", "Tune it", "Everything about what you selected is here: what it does, how well it shoots back, how it looks. Click empty map for drill settings."],
    ["play", "Play", "Saves the drill and starts it. It's also listed first in VALORANT Training."],
  ];
  let i = 0;
  const layer = h("div", { class: "coach" });
  const show = () => {
    layer.textContent = "";
    const [anchor, title, text] = steps[i];
    const r = document.querySelector(`[data-coach="${anchor}"]`).getBoundingClientRect();
    const tip = h("div", { class: "tip", role: "dialog", "aria-label": title },
      h("b", {}, h("i", {}, `${i + 1}/${steps.length}`), title), h("p", {}, text),
      h("div", { class: "row" },
        h("button", { class: "btn small ghost", onclick: done }, "Skip"),
        h("button", { class: "btn small primary", onclick: () => (i < steps.length - 1 ? (i++, show()) : done()) }, i < steps.length - 1 ? "Next" : "Got it")));
    layer.append(tip);
    const left = anchor === "side" || anchor === "play" ? Math.max(12, r.left - 296) : anchor === "tray" ? r.right + 12 : r.left + r.width / 2 - 140;
    const top = anchor === "play" ? r.bottom + 12 : anchor === "map" ? r.top + r.height / 2 - 60 : anchor === "side" ? r.top + 220 : r.top + 40;
    tip.style.left = `${Math.min(innerWidth - 292, left)}px`;
    tip.style.top = `${top}px`;
    tip.querySelector(".primary").focus();
  };
  const done = () => { layer.remove(); try { localStorage.setItem(COACH_KEY, "1"); } catch {} };
  document.body.append(layer);
  show();
}

// ---------- start ----------
(async () => {
  if (!api) {
    app.append(h("p", { style: "padding:24px" }, "The Studio only works inside the AimTrainer app."));
    return;
  }
  const wanted = new URLSearchParams(location.hash.slice(1)).get("edit");
  if (wanted) {
    history.replaceState(null, "", location.pathname);
    const drill = await api.get(wanted).catch(() => null);
    if (drill) return openDrill(drill);
  }
  showLibrary();
})();
