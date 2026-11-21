// The Studio: make your own drills.
//
// Library -> pick a place -> place bots and targets on a top-down map -> tune them -> Play.
// Drills are saved by studio-store.js (main process) and played in the lobby's VALORANT
// Training list via studio-launch.js.
import {
  MAPS, mapLabel, WEAPONS, weaponLabel, LOOKS, SMOKE_AGENTS, smokeSpec, RANKS, MOVES, ARMOR,
  newDrill, newBot, newTargets, newWall, newBarrier, newAirFloor, newSmoke, itemName, problems, compile,
  FLASH_AGENTS, FLASH_FUSE, plan, flashTarget, normalize, newTrigger, COMPILER, DEFAULT_JUMP_HEIGHT, peekModes, peekWidth, spotPeekWidth, PEEK_WIDTH,
  flashHeights, flashFlight, FLASH_THROW_Y, REYNA_REACH, yoruBounce, PHOENIX_REACH, PHOENIX_RISE, phoenixStar, flashFrom,
  BLOCK_SHAPES, newBlock, structureTops, gameBlock,
  PLAYBACKS, RECORD_SECONDS, copycatFrames, copycatAt, copycatSmokes, trackFromTake, compileRecording,
  cutTrack, trimRange, TRIM_MIN,
  canRandomSpot, usesOwnDispatcher, hasZone, zoneCorners, ZONE_MOVES, zoneCenter, zoneTurn, zoneTurnHandle, zoneTurnToward, tradeTarget, stuckTradeRings, zoneOnWall, dotSpotFields,
  wavePlans, waveList, waveName, wavePlays, inWaves, newId,
  botWallHits, strafeRoom, strafeAxis, fixedYaw,
  isDot, dotRadius, dotHeight, DOT_HEIGHT, DOT_MAX_HEIGHT, TARGET_SIZES, newDot, dotWallSnap,
} from "./drill.js";
import { arenaSize, arenaRect, setArenaRect, ARENA_REACH, ARENA_MIN, arenaWallHeight, surfaceFor, darkArena, targetColor, arenaSurface, setArenaSurface, SURFACES, ARENA_COLOR_KEYS, arenaColor, customArenaColor } from "./arena.js";
import { resizePiece, wallDepth, createPieceSnap, MIN_SIZE, MAX_SIZE } from './transform.js';
const FREE = { hardMin: MIN_SIZE, hardMax: MAX_SIZE }; // studio-free-size: what the number boxes accept
import { unpredictableOffset, botSpeed, speedScale, defaultSpeedScale, SPEED_SCALE } from './strafe.js';
import { loadMap } from "./map-data.js";
import { createView3D } from "./view3d.js";

const api = window.__aimDesktop && window.__aimDesktop.studio;
const workshop = window.__aimDesktop && window.__aimDesktop.workshop;
const app = document.getElementById("app");
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
  copycat: '<circle cx="7" cy="5" r="2.2"/><path d="M7 8v6M7 14l-2 6M7 14l2 6M4 10h6"/><circle cx="17" cy="5" r="2.2" stroke-dasharray="1.5 1.5"/><path d="M17 8v6M17 14l-2 6M17 14l2 6M14 10h6" stroke-dasharray="1.5 1.5"/>',
  rec: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
  dot: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M10 4.5l2-2 2 2M10 19.5l2 2 2-2" />', // dot-bots-v4
  targets: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  wall: '<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M3 12h18M9 7v5M15 12v5"/>',
  barrier: '<rect x="3" y="5" width="18" height="14" stroke-dasharray="3 3"/><path d="M9 12h6"/>',
  airfloor: '<path d="M3 14l5-4h13l-5 4z" stroke-dasharray="3 3"/><path d="M12 18v-2"/>', // studio-air-floor
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
  chev: '<path d="M9 6l6 6-6 6"/>',
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

// wide: room for more than three buttons in one row.
function confirmBox(title, text, buttons, { wide = false } = {}) {
  return new Promise((resolve) => {
    const close = (v) => { scrim.remove(); resolve(v); };
    const scrim = h("div", { class: "scrim", onclick: (e) => e.target === scrim && close(null) },
      h("div", { class: `dialog ${wide ? "medium" : "small"}`, role: "dialog", "aria-modal": "true" },
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
  addSpot: false, // clicking the map drops a random spot for the selected bot (Shift-click keeps dropping)
  spotSel: null, // { id, index }: the extra spot last placed or grabbed (Backspace / Del removes it)
  group: [], // ids of things selected together (Shift-click, Shift-drag a box); empty: just S.sel
  addStart: false, // clicking the map drops another place you can start (Shift-click keeps dropping)
  startSel: null, // index of the extra start last placed or grabbed (Backspace / Del removes it)
  scrub: null, // { id, t }: the selected copycat shown t seconds into its run
  libTab: "drills", // library: "drills" or "runs" (saved copycat runs)
  hist: [], fut: [], histKey: null, histAt: 0,
  map: null, img: null, mapLoading: false,
  view: null, preview: false, previewT0: 0, // previewT0: when Preview moves started (seconds, like frame time)
};
window.__studio = S; // for checking the editor from DevTools
const dirty = () => S.drill && JSON.stringify(S.drill) !== S.saved;
const selItem = () => (S.drill && S.sel && S.sel !== "start" ? S.drill.items.find((i) => i.id === S.sel) || null : null);
// ---------- selecting several things ----------
const inGroup = (id) => S.group.length > 1 && S.group.includes(id);
const groupItems = () => (S.drill ? S.drill.items.filter((i) => inGroup(i.id)) : []);
// Sets the selection to these ids: two or more make a group (the last one is S.sel), one is a normal selection.
function setGroup(ids) {
  const ok = [...new Set(ids)].filter((id) => S.drill.items.some((i) => i.id === id));
  S.group = ok.length > 1 ? ok : [];
  S.sel = ok.length ? ok[ok.length - 1] : null;
  S.addPoint = false; S.addSpot = false; S.spotSel = null;
}
// Shift-click: adds a thing to the selection, or takes it out if it's already in.
function toggleInGroup(id) {
  const now = S.group.length > 1 ? S.group : selItem() ? [S.sel] : [];
  setGroup(now.includes(id) ? now.filter((x) => x !== id) : [...now, id]);
  renderSide(); draw();
}
// Moves one thing by (ox, oz) with everything that belongs to it: route, extra spots, trigger line,
// flash target. Structures keep their height (so stacked pieces stay stacked); the rest follow the floor.
function shiftItem(o, ox, oz) {
  const r = (v) => Math.round(v * 100) / 100;
  const mv = (p) => { p.x = r(p.x + ox); p.z = r(p.z + oz); if (o.kind !== "block" && o.kind !== "wall" && p.y !== undefined) p.y = floorAt(p.x, p.z, p.y) ?? p.y; };
  mv(o);
  if (o.route) o.route.forEach(mv);
  if (Array.isArray(o.spots)) for (const s of o.spots) { mv(s); if (s.route) s.route.forEach(mv); }
  if (o.trigger) for (const end of ["a", "b"]) o.trigger[end] = { x: r(o.trigger[end].x + ox), z: r(o.trigger[end].z + oz) };
  if (o.flash && o.flash.target) o.flash.target = { ...o.flash.target, x: r(o.flash.target.x + ox), z: r(o.flash.target.z + oz) };
}
const onMap = () => S.drill && S.drill.place !== "range";
const DRAFT_KEY = 'studio-active-draft-v1';
let draftTimer = 0, draftSuppressed = false;
function rememberEditor() {
  clearTimeout(draftTimer); draftTimer = 0;
  if (draftSuppressed || S.screen !== 'editor' || !S.drill) return;
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ drill: S.drill, saved: S.saved, sel: S.sel })); } catch {}
}
function queueDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(rememberEditor, 300); }
function forgetEditor() { clearTimeout(draftTimer); draftTimer = 0; draftSuppressed = true; try { sessionStorage.removeItem(DRAFT_KEY); } catch {} }
addEventListener('beforeunload', rememberEditor);

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
  // A real top right at this height (a crate, wall or roof clicked in 3D) is kept as it is, even
  // where the standable floors above don't list it.
  if (nearY !== undefined && nearY !== null && onMap()) {
    const seen = seenTop(x, z, nearY);
    if (seen !== null) return seen;
  }
  if (nearY !== undefined && nearY !== null && onMap() && S.map && S.map.spotsAt) {
    const exact = nearestLevel(S.map.spotsAt(x, z), nearY, 0.15);
    if (exact !== null) return exact;
  }
  if (!levels.length) return null;
  if (nearY === undefined || nearY === null) return levels[0];
  return levels.reduce((best, y) => (Math.abs(y - nearY) < Math.abs(best - nearY) ? y : best), levels[0]);
}
// studio-placement: heights taken from the real map in the Detailed view. In the game you stand on the map's
// own meshes (containers, crates, props, roofs); the Creator's floor data only has the invisible blocking
// boxes and the walkable mesh, so those tops are missing from it. A spot placed on the map as you see it is
// remembered in drill.mapTops as [x, z, y], and floorAt() keeps anything standing exactly there at that
// height (in every view, after saving, and when the drill is sent to the game). Moving a thing to another
// (x, z) leaves the entry behind; edit() drops entries nothing stands on.
const sameSpot = (t, x, z) => Math.abs(t[0] - x) < 0.006 && Math.abs(t[1] - z) < 0.006;
function seenTop(x, z, nearY) {
  const list = S.drill && S.drill.mapTops;
  if (!Array.isArray(list)) return null;
  let best = null;
  for (const t of list) if (sameSpot(t, x, z) && (nearY === undefined || Math.abs(t[2] - nearY) < 0.15) && (best === null || Math.abs(t[2] - (nearY ?? t[2])) < Math.abs(best - (nearY ?? best)))) best = t[2];
  return best;
}
function rememberTop(p) {
  const list = (S.drill.mapTops ||= []);
  if (!list.some((t) => sameSpot(t, p.x, p.z) && Math.abs(t[2] - p.y) < 0.005)) list.push([p.x, p.z, p.y]);
}
function pruneTops(d) {
  if (!Array.isArray(d.mapTops)) return;
  const at = [d.start, ...(d.start.spots || [])];
  for (const it of d.items) { at.push(it, ...(it.route || [])); for (const s of it.spots || []) at.push(s, ...(s.route || [])); }
  d.mapTops = d.mapTops.filter((t) => at.some((p) => sameSpot(t, p.x, p.z) && Math.abs(t[2] - (p.y ?? 0)) < 0.15));
  if (!d.mapTops.length) delete d.mapTops;
}
// The height in `levels` nearest to y, when it is within `reach` metres; null otherwise.
function nearestLevel(levels, y, reach) {
  let best = null;
  for (const l of levels) if (Math.abs(l - y) <= reach && (best === null || Math.abs(l - y) < Math.abs(best - y))) best = l;
  return best;
}
// studio-placement: where a thing stands when you point at `at` in the 3D view. at: { x, y, z, normal, map, loose }
// from view3d.surfacePoint: the surface under the mouse. Returns { x, y, z, stand: true } on real standing
// ground, or null when there is none (the caller then leaves the thing where it was). free (Alt): no 0.1 m grid.
// Detailed view (at.map: the real map as drawn): a floor, top or slope: exactly there, feet on what you see
// (the game stands things on the same meshes). A wall or the side of a box: the ground just in front of it.
// 3D view and things you built (the Creator's own floor data):
//  1. Something to stand on right at that point and height (the map's collision or walkable floor, or a
//     structure you built): there. The map picture and its collision differ a little, hence STAND_REACH.
//  2. A wall or the side of a box: the ground just in front of it, on your side.
//  3. A thing with nothing to stand on (decoration): the ground straight below.
//  4. A gap in the floor data: the walkable floor right beside it, when it is at about that height.
const STAND_REACH = 0.6, WALL_STEP = [0.4, 0.8], DROP = 2.5;
function standOn(at, skipId, free = false) {
  const grid = (v) => Math.round(v * (free ? 100 : 10)) / (free ? 100 : 10), fine = (v) => Math.round(v * 100) / 100;
  const spots = (x, z) => {
    const base = onMap() ? (S.map && S.map.spotsAt ? S.map.spotsAt(x, z) : []) : [0];
    return [...base, ...structureTops(S.drill.items, x, z, skipId)];
  };
  const out = (x, y, z) => ({ x, y, z, stand: true });
  if (onMap() && !S.map) return out(grid(at.x), at.y ?? 0, grid(at.z));
  const n = at.normal || { x: 0, y: 1, z: 0 }, flat = Math.hypot(n.x, n.z);
  // A wall: steeper than 60 degrees (roofs and snow banks slope less and count as tops).
  const wall = Math.abs(n.y) < 0.5 && flat > 0;
  const below = (x, z) => { const l = spots(x, z).filter((y) => y <= at.y + 0.3); return l.length ? Math.max(...l) : null; };
  const inFront = () => {
    for (const d of WALL_STEP) for (const [x, z] of [[grid(at.x + (n.x / flat) * d), grid(at.z + (n.z / flat) * d)], [fine(at.x + (n.x / flat) * d), fine(at.z + (n.z / flat) * d)]]) {
      const y = below(x, z);
      if (y !== null) return out(x, y, z);
    }
    return null;
  };
  if (at.map && onMap()) {
    if (wall || n.y < 0) {
      // In front of the wall, and only where you can see it: the floor data can put the spot inside a
      // container or behind another wall, which is not what you pointed at.
      const p = flat > 0 ? inFront() : null, chest = p && view3d && view3d.screenPoint(p.x, p.y + 0.9, p.z);
      const front = chest && view3d.mapPoint(chest.x, chest.y);
      return p && chest && !(front && front.distance < chest.distance - 0.5) ? p : null;
    }
    // Scenery well outside the playable area is not part of the map.
    if (S.map.mask && S.map.mask.far(at.x, at.z)) return null;
    const p = out(fine(at.x), fine(at.y), fine(at.z));
    rememberTop(p);
    return p;
  }
  if (!at.loose) {
    // On the grid when the same surface is there too, else exactly where you pointed (edges, thin tops).
    for (const [x, z] of [[grid(at.x), grid(at.z)], [fine(at.x), fine(at.z)]]) {
      const y = nearestLevel(spots(x, z), at.y, STAND_REACH);
      if (y !== null) return out(x, y, z);
    }
    if (wall) { const p = inFront(); if (p) return p; }
    // Straight below: only the ground the thing stands on. Further down is a floor under a roof, out of sight.
    for (const [x, z] of [[grid(at.x), grid(at.z)], [fine(at.x), fine(at.z)]]) {
      const y = below(x, z);
      if (y !== null && at.y - y <= DROP) return out(x, y, z);
    }
  }
  const x = grid(at.x), z = grid(at.z);
  const y = nearestLevel(levelsHere(x, z, skipId), at.y, at.loose ? Infinity : 1.5);
  return y === null ? null : out(x, y, z);
}
// For problems(): null where you can't stand (off the map's floors, or off the range).
function floorCheck() {
  if (!S.drill) return null;
  if (!onMap()) {
    const r = arenaRect(S.drill);
    return (x, z) => (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 ? 0 : null);
  }
  return S.map ? (x, z) => seenTop(x, z) ?? floorAt(x, z) : null;
}
// bot-walls-v1: every floor height at a point (map nav mesh + things built here), for checking bot lines against
// walls (drill.js pathBlocked). Null on a map that hasn't loaded yet.
function wallLevels() {
  if (!S.drill || (onMap() && !S.map)) return null;
  // + the tops of solid things on the map (crates, ledges), where bots are often placed
  // map: only what is standable right at the point (map-data standAt), + tops of things built here
  if (!onMap()) return (x, z) => levelsHere(x, z);
  return (x, z) => [...new Set([...(S.map.standAt ? S.map.standAt(x, z) : S.map.levelsAt(x, z)), ...structureTops(S.drill.items, x, z)])];
}
// A bot's lines through walls and its strafe room, cached per bot until it, the start, the map or the built
// walls / boxes change (the 2D map draws them every frame).
const wallCache = new Map();
function wallInfo(it) {
  const lv = wallLevels();
  if (!lv || it.kind !== "bot") return null;
  const solids = S.drill.items.filter((i) => i.kind === "wall" || i.kind === "block");
  const key = JSON.stringify([it, S.drill.start, S.map ? S.map.id || S.drill.place : "range", solids]);
  const got = wallCache.get(it.id);
  if (got && got.key === key) return got.info;
  const info = { hits: botWallHits(S.drill, it, lv), room: it.move === "strafe" ? strafeRoom(S.drill, lv, it, S.drill.start) : null };
  wallCache.set(it.id, { key, info });
  if (wallCache.size > 400) wallCache.delete(wallCache.keys().next().value);
  return info;
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
  pruneTops(S.drill);
  queueDraft();
  if (!quiet) renderSide();
  updateTop();
  draw();
}
function undo() {
  if (!S.hist.length) return;
  S.fut.push(JSON.stringify(S.drill));
  S.drill = JSON.parse(S.hist.pop());
  S.histKey = null;
  queueDraft();
  if (S.sel && S.sel !== "start" && !selItem()) S.sel = null;
  renderSide(); updateTop(); draw();
}
function redo() {
  if (!S.fut.length) return;
  S.hist.push(JSON.stringify(S.drill));
  S.drill = JSON.parse(S.fut.pop());
  S.histKey = null;
  queueDraft();
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

let screenRevision = 0;
async function showLibrary({ fromEditor = false } = {}) {
  // Only the editor's explicit Drills action may replace an active editing view.
  if (S.screen === 'editor' && !fromEditor) { rememberEditor(); return; }
  forgetEditor();
  const revision = ++screenRevision;
  S.screen = "library";
  S.drill = null;
  stopLoop();
  view3d?.dispose(); view3d = null;
  await refreshDrills();
  let runs = [];
  if (S.libTab === "runs") try { runs = await api.runs(); } catch {}
  if (revision !== screenRevision || S.screen !== 'library') return;
  const tab = (id, label, count) => h("button", {
    class: "lib-tab" + (S.libTab === id ? " on" : ""), role: "tab", "aria-selected": String(S.libTab === id),
    onclick: () => { if (S.libTab !== id) { S.libTab = id; showLibrary(); } },
  }, label, count ? h("span", { class: "muted" }, count) : null);
  app.textContent = "";
  app.append(
    h("header", { class: "top" },
      h("button", { class: "btn ghost", onclick: () => { try { sessionStorage.setItem("aim-from-studio", "1"); } catch {} location.assign("/aim"); }, title: "Back to the lobby" }, ic("back"), "Lobby"),
      h("div", { class: "brand" }, h("b", {}, "Studio"), h("span", {}, "Make your own drills")),
      h("div", { class: "grow" }),
      h("button", { class: "btn primary", onclick: newDrillDialog }, ic("plus"), "New drill")),
    h("main", { class: "library" },
      h("div", { class: "steps" },
        h("div", { class: "step" }, h("i", {}, "1"), h("div", {}, h("b", {}, "Pick a place"), h("span", {}, "The training range or any map."))),
        h("div", { class: "step" }, h("i", {}, "2"), h("div", {}, h("b", {}, "Drop in bots"), h("span", {}, "Choose what they do, drag them where you want."))),
        h("div", { class: "step" }, h("i", {}, "3"), h("div", {}, h("b", {}, "Press Play"), h("span", {}, "It saves and starts. Results go in your history.")))),
      h("div", { class: "lib-head", role: "tablist" }, tab("drills", "My drills", S.drills.length), tab("runs", "Runs", S.libTab === "runs" ? runs.length : 0)),
      S.libTab === "runs" ? [
        h("div", { class: "cards" }, runs.map(runCard)),
        runs.length ? null : h("p", { class: "empty-note" }, "No saved runs yet. Record a Copycat bot's run, then press Save to library to reuse it on other copycats."),
      ] : [
        h("div", { class: "cards" },
          h("button", { class: "card new-card", onclick: newDrillDialog }, h("span", {}, ic("plus"), "New drill")),
          S.drills.map(drillCard)),
        S.drills.length ? null : h("p", { class: "empty-note" }, "No drills yet. Your drills also show up first in VALORANT Training in the lobby."),
      ]));
}

// A saved copycat run in the library: its path, rename and delete.
function runCard(run) {
  return h("article", { class: "card run-card" },
    h("div", { class: "art run-art" }, runThumb(run.track, 220, 96), h("span", { class: "place" }, placeLabel(run.place))),
    h("div", { class: "body" }, h("h3", {}, run.name), h("p", {}, runSummary(run.track))),
    h("div", { class: "actions" },
      h("button", { class: "btn small", onclick: () => renameRun(run) }, ic("edit"), "Rename"),
      h("div", { class: "grow" }),
      h("button", { class: "btn small icon danger", title: "Delete", "aria-label": `Delete ${run.name}`, onclick: () => deleteRun(run) }, ic("trash"))));
}
async function renameRun(run) {
  const name = await askName("Rename run", "Drills already using this run keep their copy.", run.name, "Rename");
  if (name === null || name === run.name) return;
  try { await api.renameRun({ id: run.id, name }); } catch (err) { toast(`Couldn't rename: ${err && err.message}`, true); }
  showLibrary();
}
async function deleteRun(run) {
  const ok = await confirmBox(`Delete "${run.name}"?`, "Copycats already using it keep their copy of the run.", [["Cancel", null], ["Delete", true, "primary"]]);
  if (!ok) return;
  try { await api.removeRun(run.id); } catch (err) { toast(`Couldn't delete: ${err && err.message}`, true); }
  showLibrary();
}

function drillCard(entry) {
  const d = entry.drill;
  const map = d.place !== "range";
  return h("article", { class: "card drill-card" },
    h("div", { class: "art" + (map ? "" : " range"), style: map ? `background-image:url(/aim-maps/${d.place}.cover.webp)` : "" },
      h("span", { class: "place" }, map ? mapLabel(d.place) : "Training range")),
    h("div", { class: "body" }, h("h3", {}, entry.name), h("p", {}, summary(d))),
    h("div", { class: "actions" },
      h("div", { class: "drill-main-actions" },
        h("button", { class: "btn primary small", onclick: () => play(entry.code) }, ic("play"), "Play"),
        h("button", { class: "btn small", onclick: () => openDrill(d) }, ic("edit"), "Edit"),
        workshop ? h("button", { class: "btn small", onclick: () => publishDrill(entry) }, "Publish") : null),
      h("div", { class: "drill-utility-actions" },
        h("button", { class: "btn small icon", title: "Make a copy", "aria-label": "Make a copy", onclick: () => copyDrill(d) }, ic("copy")),
        h("button", { class: "btn small icon danger", title: "Delete", "aria-label": "Delete", onclick: () => deleteDrill(entry) }, ic("trash")))));
}

// Errors from the desktop side arrive wrapped ("Error invoking remote method '…': Error: …");
// show only the part written for the player.
const workshopReason = (error, fallback) =>
  String(error?.message || "").replace(/^Error invoking remote method '[^']*': (?:Error: )?/, "") || fallback;
let publishing = false; // one Publish at a time: a second click must not open a second sign-in or upload
async function publishDrill(entry) {
  if (!workshop || publishing) return;
  publishing = true;
  try {
    const status = await workshop.status();
    if (!status.user) {
      await workshop.login();
      toast("Finish Discord sign-in in your browser, then press Publish again.");
      return;
    }
    const ok = await confirmBox("Publish to Community Workshop?",
      `“${entry.name}” will wait for moderator review before anyone else can see it. Once approved, it is public with your Discord display name (${status.user.name}) as the author.`,
      [["Cancel", false], ["Submit for review", true, "primary"]]);
    if (!ok) return;
    const result = await workshop.publish(entry.code);
    toast(result.message || "Submitted for review.");
  } catch (error) {
    toast(workshopReason(error, "Could not publish. Check the workshop service."), true);
  } finally {
    publishing = false;
  }
}
workshop?.onAuth((result) => {
  toast(result.ok ? `Signed in as ${result.user.name}. Press Publish again.` : result.message, !result.ok);
});

async function copyDrill(d) {
  const revision = screenRevision;
  const copy = JSON.parse(JSON.stringify(d));
  delete copy.code;
  copy.name = `${d.name} (copy)`.slice(0, 60);
  await saveDrill(copy, { quietOk: true });
  if (revision !== screenRevision || S.screen !== 'library') return;
  toast("Copied.");
  showLibrary();
}

async function deleteDrill(entry) {
  const revision = screenRevision;
  const ok = await confirmBox("Delete this drill?", `"${entry.name}" and its place in the training list will be removed. Your past results stay in your history.`, [["Cancel", false], ["Delete", true, "primary"]]);
  if (!ok) return;
  if (revision !== screenRevision || S.screen !== 'library') return;
  try { await api.remove(entry.code); }
  catch (err) { toast(`Couldn't delete: ${workshopReason(err, "the drill file could not be removed.")}`, true); return; }
  if (revision !== screenRevision || S.screen !== 'library') return;
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
        class: "place-tile" + (place === id ? " on" : ""), style: `background-image:url(${catalog.find((map) => map.id === id)?.cover || `/aim-maps/${id}.cover.webp`})`,
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
  draftSuppressed = false;
  const revision = ++screenRevision;
  S.screen = "editor";
  S.drill = normalize(JSON.parse(JSON.stringify(drill)));
  S.saved = fresh ? "" : JSON.stringify(S.drill);
  S.sel = null; S.tool = null; S.addPoint = false; S.addSpot = false;
  S.hist = []; S.fut = []; S.histKey = null;
  S.preview = false;
  S.map = null; S.img = null; S.view = null;
  rememberEditor();
  buildEditor();
  if (onMap()) await loadPlace();
  if (revision !== screenRevision || S.screen !== 'editor') return;
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
  const revision = screenRevision;
  S.mapLoading = true;
  draw();
  const id = S.drill.place;
  try {
    const [map, img] = await Promise.all([
      loadMap(id, (u) => fetch(u).then((r) => r.json())),
      new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `/aim-maps/${id}.minimap.png`; }),
    ]);
    if (revision === screenRevision && S.drill && S.drill.place === id) { S.map = map; S.img = img; }
  } catch {
    if (revision === screenRevision) toast("This map's picture couldn't be loaded.", true);
  }
  if (revision === screenRevision) S.mapLoading = false;
}

function buildEditor() {
  view3d?.dispose(); view3d = null;
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
    tool("dot", null, "dot", "ic-bot", "Dot", "A floating ball to shoot, one hit kills. Holds still or slides side to side. Sticks to walls; arrows set how high."),
    h("h4", {}, "Saved bots"),
    (savedBotsEl = h("div", { class: "saved-bots" })),
    h("h4", {}, "Targets"),
    tool("targets", null, "targets", "ic-target", "Target zone", "Floating targets pop up in an area."),
    h("h4", {}, "Build"),
    h("div", { class: "build-grid" },
      tool("wall", null, "wall", "ic-gear", "Wall", "Cover to peek from or hide behind."),
      Object.entries(BLOCK_SHAPES).map(([shape, s]) => tool("block", shape, `b-${shape}`, "ic-gear", s.label, s.tip))),
    tool("barrier", null, "barrier", "ic-air", "Invisible wall", "Keeps you (and bots) in. You can see and shoot through it."),
    tool("airfloor", null, "airfloor", "ic-air", "Invisible floor", "A floor you and the bots stand on but can't see. Bullets go through it."),
    h("h4", {}, "Utility"),
    tool("smoke", null, "smoke", "ic-gear", "Smoke", "Blocks sight at a set second."),
    h("h4", {}, "You"),
    tool("start", null, "you", "ic-you", "Your start", "Where you stand when the round starts."));

  canvas = h("canvas", { "aria-label": "Map. Click to place, drag to move, scroll to zoom." });
  ctx = canvas.getContext("2d");
  hintEl = h("div", { class: "hint" });
  const previewBtn = h("button", { class: "btn small preview-btn", title: "Show how the bots move", onclick: () => { S.preview = !S.preview; S.previewT0 = performance.now() / 1000; previewBtn.classList.toggle("on", S.preview); previewBtn.lastChild.textContent = S.preview ? "Stop preview" : "Preview moves"; draw(); } }, ic("eye"), "Preview moves");
  stage = h("section", { class: "stage", "data-coach": "map" }, canvas,
    h("div", { class: "zoom" },
      h("button", { class: "btn icon", title: "Zoom in", "aria-label": "Zoom in", onclick: () => zoomBy(1.3) }, ic("plus")),
      h("button", { class: "btn icon", title: "Zoom out", "aria-label": "Zoom out", onclick: () => zoomBy(1 / 1.3) }, ic("minus")),
      h("button", { class: "btn icon", title: "Show everything", "aria-label": "Show everything", onclick: () => { fitView(); draw(); } }, ic("fit"))),
    previewBtn, hintEl,
    h("div", { class: "view-switch", role: "radiogroup", "aria-label": "View" },
      h("button", { "data-view": "2d", onclick: () => setView(false) }, "2D"),
      h("button", { "data-view": "3d", onclick: () => setView(true) }, "3D"),
      h("button", { "data-view": "detailed", title: "The real map with textures and lighting. Loads the full map", onclick: () => setView(true, false, true) }, "Detailed")));
  side = h("aside", { class: "inspector", "data-coach": "side", "aria-label": "Settings" });
  app.append(h("div", { class: "editor" }, tray, stage, side));
  renderSavedBots();
  loadSavedBots();

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
  const revision = screenRevision;
  if (dirty()) {
    const pick = await confirmBox("Save your changes?", "You changed this drill since it was last saved.", [["Cancel", null], ["Don't save", "drop"], ["Save", "save", "primary"]]);
    if (!pick) return;
    if (pick === "save" && !(await saveCurrent())) return;
  }
  if (revision !== screenRevision || S.screen !== 'editor') return;
  showLibrary({ fromEditor: true });
}

// ---------- saving and playing ----------
// Items keep the floor height they were placed on, so a drill compiles the same with or
// without the map loaded (copies from the library); with it, heights are re-checked.
async function saveDrill(drill, { quietOk = false } = {}) {
  const current = S.drill === drill;
  const hard = problems(drill, current ? floorCheck() : null, current ? wallLevels() : null).filter((p) => !p.soft);
  if (hard.length) {
    toast(`Can't save yet: ${hard[0].text}`, true);
    return null;
  }
  drill.compiled = COMPILER;
  const { doc, type } = compile(drill, current && S.map ? (x, z, y) => floorAt(x, z, y) : null, current ? wallLevels() : null);
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
  const revision = screenRevision, drill = S.drill;
  if (!drill || S.screen !== 'editor') return false;
  const pendingSave = saveDrill(drill, { quietOk: thenPlay });
  const savedSnapshot = JSON.stringify(drill);
  const res = await pendingSave;
  if (!res) return false;
  if (revision !== screenRevision || S.screen !== 'editor' || S.drill !== drill) return false;
  S.drill.code = res.code;
  S.saved = JSON.stringify({ ...JSON.parse(savedSnapshot), code: res.code });
  updateTop();
  rememberEditor();
  if (thenPlay && dirty()) { toast('Saved. Your newer edits are still open; save them before playing.'); return false; }
  if (thenPlay) play(res.code);
  return true;
}

function play(code) {
  forgetEditor();
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
  const r = arenaRect(S.drill);
  return { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 };
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
// at: where it strafes (a peeker's peek spot); a peeker with its own direction strafes along its own left / right.
function across(item, at = item) {
  const d = dirOf(facingOf(item, at));
  return { x: -d.z, z: d.x };
}
// Where a thing looks (game yaw, degrees): a bot's fixed direction, or toward your start.
// peek-facing-v1: peekers too (their own field peekFacing, see fixedYaw in drill.js).
const fixedFacing = (item) => item.kind === "bot" && fixedYaw(item) !== null;
// peek-facing-v2: a peeker's turn handle sits on its peek spot (point 2), where its direction matters.
const turnFrom = (item) => (item.move === "peek" && item.route && item.route[1] ? item.route[1] : item);
const facingOf = (item, at = item) => (fixedFacing(item) ? fixedYaw(item) : yawDeg(at, S.drill.start));
function wallEnds(w) {
  const a = ((w.turn || 0) * Math.PI) / 180;
  const ux = Math.cos(a), uz = -Math.sin(a);
  return [{ x: w.x - (ux * w.length) / 2, z: w.z - (uz * w.length) / 2 }, { x: w.x + (ux * w.length) / 2, z: w.z + (uz * w.length) / 2 }];
}

// Where a bot is at time t in the preview (seconds).
// ---------- Preview moves: only the selected bots, trades and trigger lines ----------
// The bots the preview moves: the selected ones (a group or one bot) and the bots they trade;
// null (nothing selected): every bot.
function previewFocus() {
  const ids = S.group.length > 1 ? S.group : selItem() && selItem().kind === "bot" ? [S.sel] : [];
  if (!ids.length) return null;
  const set = new Set(ids);
  for (const id of ids) { const b = S.drill.items.find((i) => i.id === id); const tt = b && tradeTarget(S.drill, b); if (tt) set.add(tt.id); }
  return set;
}
const TRADE_KILL = 3, TRIGGER_AT = 2; // preview: the traded bot "dies" 3 s into each loop; you "cross" a trigger line 2 s in
const rand01 = (n, id) => { const v = Math.sin(n * 12.9898 + [...String(id)].reduce((h, c) => h + c.charCodeAt(0), 0) * 78.233) * 43758.5453; return v - Math.floor(v); };
// One appearance of a bot (a trade swings once): where it is `local` seconds in, hidden when it's done.
function onceAt(b, local) {
  const speed = botSpeed(b);
  if (!b.route) return local >= 0 ? { ...basePreviewPos(b, local), shown: local >= 0 } : { x: b.x, z: b.z, shown: false };
  const r = routeLegs(b, speed, true);
  if (!r || local < 0) return { x: b.x, z: b.z, shown: false };
  return legsAt(r, local) || { x: r.pts[0].x, z: r.pts[0].z, shown: false };
}
// The trade loop length: the kill, the slowest trade delay, the longest swing, then a short pause.
function tradeLoop(focus) {
  let run = 2.5, hi = 1;
  for (const x of S.drill.items) {
    if (x.kind !== "bot" || !tradeTarget(S.drill, x) || (focus && !focus.has(x.id))) continue;
    hi = Math.max(hi, x.tradeMax ?? 1);
    const r = x.route ? routeLegs(x, botSpeed(x), true) : null;
    if (r) run = Math.max(run, r.total);
  }
  return Math.min(25, TRADE_KILL + hi + run + 1);
}
function previewPos(b, t) {
  const focus = previewFocus();
  if (focus && !focus.has(b.id)) return { x: b.x, z: b.z, shown: true, faded: true };
  const rel = Math.max(0, t - S.previewT0);
  const traded = tradeTarget(S.drill, b);
  if (traded) {
    // A trade: hidden until the traded bot "dies", then shows up its trade delay later and swings once.
    const P = tradeLoop(focus), n = Math.floor(rel / P), local = rel - n * P;
    const lo = Math.max(0, b.tradeMin ?? 0.3), hi = Math.max(lo, b.tradeMax ?? 1);
    const appear = TRADE_KILL + lo + (hi - lo) * rand01(n, b.id);
    return onceAt(b, local - appear);
  }
  // A bot someone trades: "dies" TRADE_KILL s into each loop (a red X blinks where it was), back next loop.
  const trader = S.drill.items.find((x) => x.kind === "bot" && (!focus || focus.has(x.id)) && tradeTarget(S.drill, x)?.id === b.id);
  if (trader) {
    const P = tradeLoop(focus), n = Math.floor(rel / P), local = rel - n * P;
    if (local >= TRADE_KILL) {
      const at = basePreviewPos(b, S.previewT0 + n * P + TRADE_KILL);
      return { x: at.x, z: at.z, y: at.y, shown: false, deadAge: local - TRADE_KILL < 0.8 ? local - TRADE_KILL : undefined };
    }
    return basePreviewPos(b, t);
  }
  if (b.trigger) {
    // A trigger line: you "cross" it TRIGGER_AT s into each loop (the line flashes), it shows up its delay later.
    const start = TRIGGER_AT + (b.delay || 0), L = start + 10, local = rel % L;
    const flash = local >= TRIGGER_AT && local < TRIGGER_AT + 0.8;
    if (local < start) return { x: b.x, z: b.z, shown: false, trigFlash: flash };
    return { ...basePreviewPos(b, local - start), trigFlash: flash };
  }
  return basePreviewPos(b, t);
}
// Where a timed route is `local` seconds in (null after its end).
function legsAt(part, local) {
  const age = part.flashStart >= 0 && local >= part.flashStart && local - part.flashStart < 2 ? local - part.flashStart : undefined;
  let left = local;
  for (const leg of part.legs) {
    if (left > leg.time) { left -= leg.time; continue; }
    if (leg.from) {
      const f = leg.time ? left / leg.time : 1;
      return { x: leg.from.x + (leg.to.x - leg.from.x) * f, z: leg.from.z + (leg.to.z - leg.from.z) * f, shown: true, flashAge: age };
    }
    return { x: leg.at.x, z: leg.at.z, shown: !leg.hidden, flashAge: age };
  }
  return null;
}
function basePreviewPos(b, t) {
  if (b.move === "copycat") {
    const wait = b.delay || 0, at = copycatAt(b, S.drill.start, t - wait);
    return at ? { x: at.x, y: at.y, z: at.z, crouch: at.crouch, shown: t >= wait } : { x: b.x, z: b.z, shown: true };
  }
  const speed = botSpeed(b);
  if (b.move === "strafe") {
    const a = across(b);
    if (b.unpredictable === true) {
      const offset = unpredictableOffset(b, t);
      return { x: b.x + a.x * offset, z: b.z + a.z * offset, shown: true };
    }
    const half = b.width / 2;
    const period = (2 * b.width) / speed + 1;
    const p = (t % period) / period;
    const s = p < 0.5 ? -half + Math.min(1, (p * period) / (b.width / speed)) * b.width : half - Math.min(1, ((p - 0.5) * period) / (b.width / speed)) * b.width;
    return { x: b.x + a.x * s, z: b.z + a.z * s, shown: true };
  }
  // The same route the game gets (plan() in drill.js): stops, A-D steps, flash, loop or vanish.
  // A bot with random spots plays them one after another in a random order (never the same twice
  // in a row), like the game's dispatcher.
  const variants = previewVariants(b);
  const parts = [];
  let total = 0;
  for (const v of previewOrder(b, variants)) {
    const r = routeLegs(v.bot, speed);
    if (!r) continue;
    parts.push({ ...r, from: total, label: v.label });
    total += r.total;
  }
  if (!parts.length) return { x: b.x, z: b.z, shown: true };
  const now = t % (total || 1);
  const part = parts.find((q) => now < q.from + q.total) || parts[parts.length - 1];
  const local = now - part.from;
  // Seconds since the flash was thrown, while it flies and pops.
  const age = part.flashStart >= 0 && local >= part.flashStart && local - part.flashStart < 2 ? local - part.flashStart : undefined;
  let left = local;
  for (const leg of part.legs) {
    if (left > leg.time) { left -= leg.time; continue; }
    if (leg.from) {
      const f = leg.time ? left / leg.time : 1;
      return { x: leg.from.x + (leg.to.x - leg.from.x) * f, z: leg.from.z + (leg.to.z - leg.from.z) * f, shown: true, flashAge: age };
    }
    return { x: leg.at.x, z: leg.at.z, shown: !leg.hidden, flashAge: age };
  }
  return { x: part.pts[0].x, z: part.pts[0].z, shown: true };
}

// One pass of a bot's route for the preview: timed legs (walks and stops) from plan().
function routeLegs(b, speed, once = peeksOnce(b)) {
  const p = plan(b, S.drill.start, once);
  if (!p) return null;
  const legs = [];
  let total = 0, flashStart = -1;
  const pts = p.pts;
  const wait = (at, time, flash) => { if (flash) flashStart = total; legs.push({ at, time }); total += time; };
  const walk = (from, to) => { const time = dist(from, to) / speed; legs.push({ from, to, time }); total += time; };
  pts.forEach((q, i) => {
    if (i === p.flashAt) wait(q, b.flash.wait ?? 1, true);
    else if (q.wait > 0) wait(q, q.wait);
    if (i < pts.length - 1) walk(q, pts[i + 1]);
  });
  if (p.loop) walk(pts[pts.length - 1], pts[0]);
  // Hidden behind cover: its time behind cover plus half its random extra wait (the average).
  else wait(pts[pts.length - 1], p.hidden + (b.move === "peek" ? (b.randomWait || 0) / 2 : 0), false), (legs[legs.length - 1].hidden = true);
  return { legs, total, flashStart, pts };
}

// The versions of a bot the preview plays: each of its spots (zones stay hidden on purpose), and for a
// peeker that strafes or holds at random, both ways at each spot.
function previewVariants(b) {
  const spots = canRandomSpot(b) ? [{ x: b.x, y: b.y, z: b.z, route: b.route }, ...(b.spots || []).filter((s) => !b.route || (s.route && s.route.length >= 2))] : [{ x: b.x, y: b.y, z: b.z, route: b.route }];
  const modes = b.move === "peek" && canRandomSpot(b) ? peekModes(b) : [b.peekStrafe];
  return spots.flatMap((s, spot) => modes.map((mode) => ({ spot, bot: { ...b, x: s.x, y: s.y, z: s.z, ...(s.route ? { route: s.route } : {}), ...(Number.isFinite(s.peekWidth) ? { peekWidth: s.peekWidth } : {}), peekStrafe: mode }, label: null })));
}
// A fixed random-looking order (from the bot's id) of 12 passes, never the same spot twice in a row
// (strafe or hold at the same spot can repeat, like the game).
function previewOrder(b, variants) {
  if (variants.length < 2) return variants;
  let seed = [...String(b.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const manySpots = new Set(variants.map((v) => v.spot)).size > 1;
  const out = [];
  for (let i = 0; i < Math.max(12, variants.length * 2); i++) {
    const last = out[out.length - 1];
    const ok = last && manySpots ? variants.filter((v) => v.spot !== last.spot) : variants;
    out.push(ok[Math.floor(rnd() * ok.length)]);
  }
  return out;
}

// Dragging "Preview the run" on a copycat's panel shows it at that moment of its run.
function scrubPos(b) {
  if (!S.scrub || S.scrub.id !== b.id || S.sel !== b.id) return null;
  const at = copycatAt(b, S.drill.start, S.scrub.t);
  return at && { x: at.x, y: at.y, z: at.z, crouch: at.crouch, shown: true };
}

// Bots take turns (so a peeker peeks once and hides).
const takingTurns =() => S.drill.round.order !== "together" && S.drill.round.order !== "waves" && S.drill.round.goal !== "track";
// A bot that peeks once and hides each time: taking turns, or random spots / random wait (drill.js).
// turns-pause-zero-v1: bots that take turns (same rule as turnTaker in drill.js compile) come back on their next
// turn, after the round's "Pause before the next one"; their own Comes back after slider does nothing there.
const takesTurn = (b) => takingTurns() && !b.trigger && !b.tradeOf && b.move !== "copycat" && !(b.move === "patrol" && !(b.flash && b.flash.on));
const TURN_BACK_HELP = "Comes back on its next turn. The wait is Drill settings > Pause before the next one.";
const peeksOnce = (b) => takingTurns() || usesOwnDispatcher(b) || inWaves(S.drill).has(b.id);

// Draws a bot's flash: the throw path to where it pops and, in the preview, the flash
// flying (FLASH_FUSE seconds) and popping.
// A bot's flash as the game flies it (see flashFlight in drill.js): from its throw point to the star.
function botFlight(b) {
  const p = plan(b, S.drill.start, peeksOnce(b));
  const target = flashTarget(b, S.drill.start);
  if (!p || p.flashAt < 0 || !target) return null;
  const from = p.pts[p.flashAt];
  const fromY = floorAt(from.x, from.z, from.y) ?? from.y ?? 0;
  const curve = flashCurve(b, from, target);
  const agent = b.flash.agent || "phoenix", throwAt = { x: from.x, y: fromY + FLASH_THROW_Y, z: from.z };
  // Yoru: arc to the bounce surface (wall or floor), bounce, pop 0.6 s later, as the game flies it.
  const yb = agent === "yoru" ? yoruBounce(b.flash, from, target, fromY) : null;
  const popY = fromY + (b.flash.height ?? 2.2);
  const flight = flashFlight(agent, throwAt, yb ? yb.target : { x: target.x, y: popY, z: target.z }, curve, yb?.normal, { right: b.flash.curve !== "left", under: b.flash.throw === "under", floorY: fromY });
  return { from, fromY, target, curve, flight };
}

function drawFlash(b, isSel, flashAge) {
  const bf = botFlight(b);
  if (!bf) return;
  const { target, flight } = bf;
  ctx.strokeStyle = isSel ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.45)";
  ctx.lineWidth = isSel ? 2 : 1.4;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) { const q = flight.point(i / 16); i ? ctx.lineTo(...pt(q.x, q.z)) : ctx.moveTo(...pt(q.x, q.z)); }
  ctx.stroke();
  ctx.setLineDash([]);
  // phoenix-reach-v1: Phoenix's star can only be on this circle (its fixed reach around the throw point).
  const fr = isSel && (b.flash.agent || "phoenix") === "phoenix" ? flashFrom(b, S.drill.start) : null;
  if (fr) {
    const [fx, fy] = pt(fr.x, fr.z), [rx, ry] = pt(fr.x + PHOENIX_REACH, fr.z), R = Math.hypot(rx - fx, ry - fy);
    ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.arc(fx, fy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  const [tx, ty] = pt(target.x, target.z);
  // Reyna's eye stops at its reach (8.41 m): faint line past it, a ring where it stops.
  if (flight.short) {
    const [sx, sy] = pt(flight.at.x, flight.at.z);
    ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = "#ff4655"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.stroke();
    if (isSel) { ctx.fillStyle = "#ff4655"; ctx.font = "11px Bahnschrift, sans-serif"; ctx.fillText(`Eye stops here (reach ${REYNA_REACH} m)`, sx + 10, sy - 8); }
  }
  const [px, py] = pt(flight.at.x, flight.at.z);
  if (flashAge !== undefined && flashAge < flight.fly) {
    const q = flight.point(flashAge / flight.fly);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(...pt(q.x, q.z), 5, 0, Math.PI * 2); ctx.fill();
  } else if (flashAge !== undefined && flashAge < flight.fly + flight.glow) {
    const k = (flashAge - flight.fly) / flight.glow;
    const r = 10 + k * Math.max(30, 6 * S.view.k);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
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
try { const v = localStorage.getItem("studio-view"); S.mode3d = v === "3d" || v === "detailed"; S.detailed = v === "detailed"; } catch { S.mode3d = S.detailed = false; }

// Detailed is the 3D view with the real game map in place of the floor blockout.
function setView(on, first = false, detailed = on && first ? S.detailed : false) {
  S.mode3d = on;
  S.detailed = on && detailed;
  try { localStorage.setItem("studio-view", S.detailed ? "detailed" : on ? "3d" : "2d"); } catch {}
  if (on && !view3d) {
    view3d = createView3D(stage, { redraw: () => draw() });
    bind3D(view3d);
    view3d.resize();
    const st = S.drill.start;
    view3d.frame(st, st.y || 0, st.facing || 0);
  }
  canvas.style.display = on ? "none" : "";
  if (view3d) { view3d.canvas.style.display = on ? "" : "none"; view3d.labels.style.display = on ? "" : "none"; }
  stage.querySelector(".zoom").style.display = on ? "none" : "";
  if (view3d) view3d.status.style.display = on ? "" : "none";
  const current = S.detailed ? "detailed" : on ? "3d" : "2d";
  for (const b of stage.querySelectorAll(".view-switch button")) b.classList.toggle("on", b.dataset.view === current);
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
  turnFrom: (it) => turnFrom(it),
  across: (it, at) => across(it, at),
  peekWidth: (it) => peekWidth(it),
  spotPeekWidth: (it, s) => spotPeekWidth(it, s),
  inGroup: (id) => inGroup(id),
  startSel: () => S.startSel,
  groupKey: () => S.group.join(",") + "|" + waveKey(),
  faded: (it) => waveFaded(it),
  smokeSpec: (it) => smokeSpec(it),
  wallEnds: (it) => wallEnds(it),
  dir: (deg) => dirOf(deg),
  previewPos: (it, t) => previewPos(it, t),
  stillPos: (it) => scrubPos(it),
  runFrames: (it) => (it.move === "copycat" ? copycatFrames(it, S.drill.start) : null),
  FUSE: FLASH_FUSE,
  // Throw path of a bot's flash as the game flies it (flight: point(u), at, fly, glow, short).
  flashPath(it) {
    if (!it.flash || !it.flash.on) return null;
    const bf = botFlight(it);
    if (!bf) return null;
    return { curve: bf.curve, target: bf.target, fromY: bf.fromY, toY: bf.flight.bounce ? bf.flight.bounce.y : bf.fromY + (it.flash.height ?? 2.2), flight: bf.flight };
  },
};

function paint3d(t) {
  view3d.setWorld(onMap() ? S.map : null, JSON.stringify(arenaRect(S.drill)), S.drill, S.detailed);
  view3d.sync(S.drill, S.sel, helpers3d, S.preview);
  if (S.preview) view3d.animate(t, helpers3d); else view3d.still(helpers3d);
  view3d.render();
}

// 3D mouse: left-drag empty space turns the camera, right-drag (or Shift+left) moves it,
// scroll zooms. Clicking and dragging things works like in 2D.
// Drags that follow the surface under the mouse in 3D (the rest stay at their height).
const FOLLOWS = new Set(["item", "start", "point", "spotMove", "spotPoint", "startSpot"]);
function bind3D(v) {
  const c = v.canvas;
  let mode = null, last = null, travel = 0;
  const local = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const toHit = (d) => {
    if (!d) return null;
    if (d.type === "start" || d.type === "turn") return { type: d.type };
    if (d.type === "startSpot" || d.type === "startSpotTurn") return { ...d };
    const item = S.drill.items.find((i) => i.id === d.id);
    return item ? { ...d, item } : null;
  };
  // studio-placement: the standing spot under a screen point (see standOn), or null.
  const spotAt = (px, py, skipId, free, fallbackY) => { const at = v.surfacePoint(px, py, skipId, fallbackY); return at ? standOn(at, skipId, free) : null; };
  // dot-bots-v2: the surface under the mouse with the way it faces (walls, boxes, floors, the drawn map), or null.
  const dotHitAt = (px, py) => { const at = v.surfacePoint(px, py) || v.hitPoint(px, py); return at && !at.loose && at.normal ? at : v.hitPoint(px, py); };
  const clickSpot = (px, py, free) => {
    const at = spotAt(px, py, undefined, free);
    if (!at) toast("Nothing to stand on there. Point at a floor, a box or a ledge.");
    return at;
  };
  c.addEventListener("pointerdown", (e) => {
    flushMove();
    c.setPointerCapture(e.pointerId);
    const [px, py] = local(e);
    last = { x: e.clientX, y: e.clientY };
    travel = 0;
    if (e.button === 2) {
      const hit = toHit(v.pick(px, py));
      if (hit && hit.type === "point") { removePoint(hit.item, hit.index); mode = null; return; }
      mode = "pan"; return;
    }
    if (e.button === 0 && e.shiftKey && !S.tool && !S.addPoint && !S.addSpot) {
      const t = toHit(v.pick(px, py));
      if (t && t.item && t.type !== "transform") { toggleInGroup(t.item.id); mode = null; return; }
    }
    if (e.button === 1 || (e.button === 0 && e.shiftKey && !S.tool)) { mode = "pan"; return; }
    if (e.button !== 0) return;
    if (S.tool && S.tool.kind === "dot") { const at = dotHitAt(px, py); if (at) place(S.tool, { ...at, stand: true }); else toast("Point at a floor or a wall."); if (!e.shiftKey) setTool(null); mode = null; return; }
    if (S.tool) { const at = clickSpot(px, py, e.altKey); if (at) place(S.tool, at); if (!e.shiftKey) setTool(null); mode = null; return; }
    const sel = selItem();
    if (S.addPoint && sel && sel.route) { const at = clickSpot(px, py, e.altKey); if (at) addPoint(sel, at); mode = null; return; }
    if (S.addSpot && sel && sel.kind === "bot") { const at = clickSpot(px, py, e.altKey); if (at) addSpotAt(sel, at); if (!e.shiftKey) { S.addSpot = false; renderSide(); } mode = null; draw(); return; }
    if (S.addStart && S.sel === "start") { const at = clickSpot(px, py, e.altKey); if (at) addStartAt(at); if (!e.shiftKey) { S.addStart = false; renderSide(); } mode = null; draw(); return; }
    const hit = toHit(v.pick(px, py));
    S.spotSel = hit && (hit.type === "spotMove" || hit.type === "spotPoint") ? { id: hit.item.id, index: hit.spot } : null;
    if (!hit) { mode = "orbit"; return; }
    const target = hit.item ? hit.item.id : "start";
    S.startSel = hit.type === "startSpot" || hit.type === "startSpotTurn" ? hit.index : null;
    const groupGrab = !!(hit.item && hit.type === "item" && inGroup(hit.item.id));
    if (groupGrab) S.sel = target;
    else if (S.group.length) { S.group = []; S.sel = target; renderSide(); }
    if (target !== S.sel) { S.sel = target; S.addPoint = false; S.addSpot = false; renderSide(); }
    const obj = hit.item || S.drill.start;
    if (hit.type === 'transform') {
      if (Number.isInteger(hit.spot)) S.spotSel = { id: obj.id, index: hit.spot };
      const gesture = v.beginTransform(hit, px, py);
      if (!gesture) { mode = null; return; }
      drag = { ...hit, key: `transform-${Date.now()}`, original: structuredClone(obj), snapping: obj.kind === "smoke" || isDot(obj) ? null : createPieceSnap(S.drill.items, obj), gesture, moved: false };
      mode = 'transform';
      draw(); return;
    }
    // A peeker's strafe-width handles sit at its peek spot (point 2), which can be on another floor height.
    const spot = (hit.type === "spotMove" || hit.type === "spotPoint") && obj.spots ? obj.spots[hit.spot] : null;
    const peekSpot = hit.type === "spotPeekWidth" && obj.spots && obj.spots[hit.spot] && obj.spots[hit.spot].route ? obj.spots[hit.spot].route[1] : null;
    const startSpot = (hit.type === "startSpot" || hit.type === "startSpotTurn") && S.drill.start.spots ? S.drill.start.spots[hit.index] : null;
    // drag3d-points-v1 (17 Nov 2026): a route point is grabbed by ITSELF. Before, point 2+ (a peeker's peek spot,
    // a runner's / rusher's later points, and the same on a random spot's route) used the bot's own position as the
    // grab reference, so the point jumped toward the bot on the first move and then jittered against the mouse.
    const routePoint = hit.type === "point" && obj.route ? obj.route[hit.index]
      : hit.type === "spotPoint" && spot && spot.route ? spot.route[hit.index] : null;
    const ref = hit.type === "peekWidth" && obj.route && obj.route[1] ? obj.route[1] : routePoint || peekSpot || spot || startSpot || (hit.type === "botTurn" ? turnFrom(obj) : obj);
    let planeY = (hit.type === "botTurn" || hit.type === "startSpotTurn" ? 1.5 : 0) + (floorAt(ref.x, ref.z, ref.y, obj.kind === "block" ? obj.id : undefined) ?? ref.y ?? 0);
    // drag3d-points-v1: the flash star is drawn in the air (its pop height); drag it on that height, so it stays under
    // the mouse instead of jumping to where the mouse ray meets the floor.
    if (hit.type === "flash" && obj.flash && obj.flash.agent !== "yoru") { const fp = helpers3d.flashPath(obj); if (fp && Number.isFinite(fp.toY)) planeY = fp.toY; }
    const at = v.planePoint(px, py, planeY) || { x: obj.x, z: obj.z };
    drag = { ...hit, key: `drag-${Date.now()}`, dx: obj.x - at.x, dz: obj.z - at.z, moved: false, planeY, baseY: obj.y, groupGrab, snapping: spot || groupGrab ? null : createPieceSnap(S.drill.items, obj) };
    // studio-placement: things that follow the surface are dragged by their feet. The mouse keeps the
    // distance it had on screen to the thing's feet when you grabbed it, and the feet go to whatever is
    // under that screen point. (Before: an offset measured on one flat height, applied on every height,
    // so the thing was looked up beside the spot you pointed at and hopped between levels at edges.)
    if (FOLLOWS.has(hit.type) && !drag.snapping) {
      const foot = v.screenPoint(ref.x, planeY, ref.z);
      Object.assign(drag, { feet: true, sx: foot ? foot.x - px : 0, sy: foot ? foot.y - py : 0, dx: 0, dz: 0 });
    }
    // A whole spot follows the floor under the mouse from where you grabbed it.
    if (hit.type === "spotMove" && spot) Object.assign(drag, { ax: spot.x, az: spot.z, orig: structuredClone(spot) });
    mode = "drag";
    draw();
  });
  const move = (e) => {
    const [px, py] = local(e);
    pointer.x = px; pointer.y = py; pointer.inside = true;
    if (!mode) { c.style.cursor = S.tool || S.addPoint || S.addSpot ? "crosshair" : v.pick(px, py) ? "pointer" : ""; return; }
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    travel += Math.abs(dx) + Math.abs(dy);
    if (mode === "orbit") v.orbitBy(dx, dy);
    else if (mode === "pan") v.panBy(dx, dy);
    else if (mode === 'transform' && drag) {
      if (travel < 3) return;
      const { original, gesture } = drag;
      const delta = drag.action === 'rotate' ? v.rotationDelta(gesture, original, px, py) : v.transformDelta(gesture, px, py);
      if (delta === null || !Number.isFinite(delta)) return;
      // Every movement in this pointer gesture belongs to one undo entry.
      if (S.histKey === drag.key) S.histAt = performance.now();
      edit(d => {
        const item = d.items.find(i => i.id === original.id);
        if (!item) return;
        if (drag.action === 'rotate') {
          const value = (original.turn || 0) + delta;
          item.turn = ((e.altKey ? value : Math.round(value / 5) * 5) % 360 + 360) % 360;
        } else {
          if (isDot(original) && Number.isInteger(drag.spot)) {
            // dot-spots-v2: one random spot's own height (its white arrows in 3D).
            const os = (original.spots || [])[drag.spot], s = (item.spots || [])[drag.spot];
            if (os && s) { const v2 = spotHeight(original, os) + (drag.sign || 1) * delta; s.dotHeight = Math.max(0.2, Math.min(DOT_MAX_HEIGHT, e.altKey ? Math.round(v2 * 100) / 100 : Math.round(v2 * 10) / 10)); }
          } else if (isDot(original)) { const v2 = dotHeight(original) + (drag.sign || 1) * delta; item.dotHeight = Math.max(0.2, Math.min(DOT_MAX_HEIGHT, e.altKey ? Math.round(v2 * 100) / 100 : Math.round(v2 * 10) / 10)); }
          else if (original.kind === "smoke") { const v2 = (original.height || 0) + delta; item.height = Math.max(0, Math.min(30, e.altKey ? v2 : Math.round(v2 * 10) / 10)); }
          else resizePiece(item, original, drag.dimension, drag.sign, delta, e.altKey);
          drag.snapping?.resize(item, original, drag.dimension, drag.sign, e.altKey);
        }
      }, { key: drag.key, quiet: true });
      drag.moved = true;
    }
    else if (mode === "drag" && drag) {
      // Things you move follow the surface under the mouse, so dragging a bot onto a built
      // floor puts it on top; handles (widths, turns, the flash star) stay at their height.
      const onSurface = FOLLOWS.has(drag.type);
      // dot-bots-v2: a dot goes onto whatever is under the mouse, walls included.
      if (drag.type === "item" && isDot(drag.item) && !drag.groupGrab) { const hit = dotHitAt(px, py, drag.item.id); if (hit) dragMove(e, { ...hit, dotHit: true }); c.style.cursor = hit ? "grabbing" : "not-allowed"; draw(); return; }
      // A Yoru flash star sticks to the wall/floor under the mouse (exact bounce point and surface).
      const yoruAim = drag.type === "flash" && drag.item?.flash?.agent === "yoru";
      const at = yoruAim ? (v.hitPoint(px, py) ?? v.planePoint(px, py, drag.planeY))
        : drag.snapping ? v.planePoint(px, py, drag.planeY)
        : onSurface ? spotAt(px + (drag.sx || 0), py + (drag.sy || 0), drag.item && ["block", "wall"].includes(drag.item.kind) ? drag.item.id : undefined, e.altKey, drag.planeY) : v.planePoint(px, py, drag.planeY);
      if (at) dragMove(e, at);
      // Nothing solid under the mouse (a roof or prop the game has no collision for, or off the map):
      // the thing stays where it last stood, and the cursor says why.
      if (onSurface && !drag.snapping) c.style.cursor = at ? "grabbing" : "not-allowed";
    }
    draw();
  };
  let pendingMove = null, moveFrame = 0;
  const flushMove = () => {
    if (moveFrame) cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    const event = pendingMove; pendingMove = null;
    if (event) move(event);
  };
  c.addEventListener("pointermove", e => {
    pendingMove = e;
    if (!moveFrame) moveFrame = requestAnimationFrame(() => {
      flushMove();
      if (raf) { cancelAnimationFrame(raf); raf = 0; frame(performance.now()); }
    });
  });

  const end = () => {
    flushMove();
    // A click on empty space (no camera turn) clears the selection, like in 2D.
    if (mode === "orbit" && travel < 4 && (S.sel !== null || S.group.length)) { S.sel = null; S.group = []; S.addPoint = false; S.addSpot = false; renderSide(); }
    if (drag && drag.groupGrab && !drag.moved) { setGroup([drag.item.id]); renderSide(); }
    else if (drag && drag.moved) renderSide();
    if (mode === 'transform') S.histKey = null;
    drag = null; mode = null;
    draw();
  };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", end);
  c.addEventListener("contextmenu", (e) => e.preventDefault());
  c.addEventListener("wheel", (e) => { e.preventDefault(); v.zoomBy(Math.exp(-e.deltaY * 0.0015)); draw(); }, { passive: false });
  const observer = new ResizeObserver(() => { v.resize(); draw(); }); observer.observe(stage);
  const disposeView = v.dispose;
  v.dispose = () => { observer.disconnect(); if (moveFrame) cancelAnimationFrame(moveFrame); pendingMove = null; disposeView(); };
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
    // studio-arena-rect: the arena can be any rectangle; grid lines on whole metres.
    const r = arenaRect(d);
    const corners = [pt(r.x0, r.z0), pt(r.x1, r.z0), pt(r.x1, r.z1), pt(r.x0, r.z1)];
    const outline = () => { ctx.beginPath(); corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    ctx.fillStyle = "#12161d";
    outline(); ctx.fill();
    ctx.lineWidth = 1;
    const gridColor = (m) => m === 0 ? "rgba(255,70,85,.45)" : m % 5 === 0 ? "rgba(140,160,180,.28)" : "rgba(140,160,180,.09)";
    for (let m = Math.ceil(r.x0); m <= r.x1; m += 1) { if (k < 6 && m % 5 !== 0) continue; ctx.strokeStyle = gridColor(m); line(m, r.z0, m, r.z1); }
    for (let m = Math.ceil(r.z0); m <= r.z1; m += 1) { if (k < 6 && m % 5 !== 0) continue; ctx.strokeStyle = gridColor(m); line(r.x0, m, r.x1, m); }
    const resizing = drag && drag.type === "arenaEdge";
    ctx.strokeStyle = resizing ? "#ff4655" : "rgba(140,160,180,.5)";
    ctx.lineWidth = resizing ? 2 : 1;
    outline(); ctx.stroke();
    // Edge arrows: drag to make the arena wider / narrower / longer / shorter.
    for (const h of arenaHandles()) handleArrow(h.x, h.z, h.dir.x, h.dir.z, resizing && drag.side === h.side);
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
    ctx.strokeStyle = bad(it.x, it.z) ? COLORS.bad : it.id === sel ? "#fff" : it.invisible ? "#7fd8ff" : surfaceFor(d, it).color;
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
    ctx.strokeStyle = targetColor(d);
    ctx.lineWidth = it.id === sel ? 4 : 3;
    ctx.setLineDash([6, 4]);
    line(p1.x, p1.z, p2.x, p2.z);
    ctx.setLineDash([]);
    const n = Math.max(1, Math.min(it.count, 6));
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      const wob = S.preview && it.motion !== "still" ? Math.sin(t * (it.motion === "fast" ? 5 : 2.2) + i) * (it.motion === "fast" ? 1.2 : 0.5) : 0;
      const px = p1.x + (p2.x - p1.x) * f + a.x * wob, pz = p1.z + (p2.z - p1.z) * f + a.z * wob;
      ctx.fillStyle = targetColor(d);
      ctx.beginPath(); ctx.arc(...pt(px, pz), Math.max(4, 0.25 * k), 0, Math.PI * 2); ctx.fill();
    }
    if (it.id === sel) { handle(p1.x, p1.z, "#fff"); handle(p2.x, p2.z, "#fff"); }
    label(it, it, 14, it.id === sel);
  }

  // Bots: routes, then bodies
  for (const it of d.items.filter((i) => i.kind === "bot")) {
    const isSel = it.id === sel;
    // waves-tabs-v1: a bot of another wave: a faint body only (no route, spots, trade or flash lines, no name).
    if (waveFaded(it)) { ctx.globalAlpha = 0.16; body(it, { x: it.x, z: it.z, shown: true }, false, false); ctx.globalAlpha = 1; continue; }
    drawZones(it, isSel);
    drawSpots(it, isSel, bad);
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
      // A-D steps at the peek spot, as wide as its "How wide"; dashed when it only sometimes strafes.
      const s = it.route[1], a = across(it, s), half = peekWidth(it) / 2;
      const p1 = { x: s.x - a.x * half, z: s.z - a.z * half }, p2 = { x: s.x + a.x * half, z: s.z + a.z * half };
      ctx.strokeStyle = isSel ? COLORS.route : "rgba(255,181,71,.55)";
      ctx.lineWidth = 2;
      if (it.peekStrafe === "random") ctx.setLineDash([5, 4]);
      line(p1.x, p1.z, p2.x, p2.z);
      ctx.setLineDash([]);
      // Drag either end to set how wide it strafes (like a strafer's end dots).
      if (isSel) { handle(p1.x, p1.z, COLORS.route); handle(p2.x, p2.z, COLORS.route); }
      arrow(s, p1, ctx.strokeStyle); arrow(s, p2, ctx.strokeStyle);
    }
    if (it.move === "copycat") drawRun(it, isSel);
    const at = S.preview ? previewPos(it, t) : scrubPos(it) || { x: it.x, z: it.z, shown: true };
    if (at.faded) ctx.globalAlpha = 0.28;
    if (it.trigger) drawTrigger(it, isSel);
    if (at.trigFlash) {
      // Preview: "you" just crossed its line.
      ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5; line(it.trigger.a.x, it.trigger.a.z, it.trigger.b.x, it.trigger.b.z);
      const [mx, my] = pt((it.trigger.a.x + it.trigger.b.x) / 2, (it.trigger.a.z + it.trigger.b.z) / 2);
      ctx.font = "800 12px Bahnschrift, Segoe UI"; ctx.textAlign = "center"; ctx.fillStyle = "#ffffff"; ctx.fillText("you cross", mx, my + 18); ctx.restore();
    }
    if (it.tradeOf) drawTrade(it, isSel);
    drawWallHits(it); // bot-walls-v1
    if (it.flash && it.flash.on) drawFlash(it, isSel, S.preview ? at.flashAge : undefined);
    if (at.shown) body(it, at, isSel, bad(it.x, it.z));
    if (at.deadAge !== undefined) {
      // Preview: this bot was just "killed" (a bot trades it).
      const [dx, dy] = pt(at.x, at.z), rr = Math.max(9, 0.45 * k);
      ctx.save(); ctx.globalAlpha = 1 - at.deadAge / 0.8; ctx.strokeStyle = "#ff4655"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(dx - rr, dy - rr); ctx.lineTo(dx + rr, dy + rr); ctx.moveTo(dx + rr, dy - rr); ctx.lineTo(dx - rr, dy + rr); ctx.stroke();
      ctx.font = "800 12px Bahnschrift, Segoe UI"; ctx.textAlign = "center"; ctx.fillStyle = "#ff4655"; ctx.fillText("killed", dx, dy - rr - 6); ctx.restore();
    }
    label(it, at, Math.max(12, 0.45 * k) + 6, isSel);
    ctx.globalAlpha = 1;
  }

  // Things selected together: a dashed white ring around each one.
  if (S.group.length > 1) {
    ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    for (const it of groupItems()) {
      const [qx, qy] = pt(it.x, it.z);
      const m = it.kind === "bot" ? 0.6 : it.kind === "smoke" ? 4.6 : it.kind === "wall" ? (it.length || 4) / 2 : it.kind === "targets" ? (it.width || 6) / 2 : Math.max(it.w || 1, it.d || 1) / 2 + 0.3;
      ctx.beginPath(); ctx.arc(qx, qy, Math.max(14, 0.45 * k + 6, m * k), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  if (drag && drag.type === "box") {
    ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    const x = Math.min(drag.px, drag.bx), y = Math.min(drag.py, drag.by), w = Math.abs(drag.bx - drag.px), hgt = Math.abs(drag.by - drag.py);
    ctx.fillRect(x, y, w, hgt); ctx.strokeRect(x, y, w, hgt); ctx.restore();
  }

  // Extra places you can start: dashed green rings (one is picked each round) with where you look.
  if (Array.isArray(st.spots)) st.spots.forEach((s, j) => {
    const rr = Math.max(13, 0.45 * k), [sx, sy2] = pt(s.x, s.z), f = dirOf(s.facing ?? st.facing);
    const picked = sel === "start" && S.startSel === j;
    ctx.save();
    ctx.globalAlpha = sel === "start" ? 1 : 0.6;
    ctx.fillStyle = picked ? "rgba(67,240,138,.35)" : "rgba(67,240,138,.14)";
    ctx.strokeStyle = bad(s.x, s.z) ? COLORS.bad : COLORS.start; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(sx, sy2, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COLORS.start; ctx.font = `800 ${Math.max(9, rr * 0.5)}px Bahnschrift, Segoe UI`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`START ${j + 2}`, sx, sy2 + 0.5); ctx.textBaseline = "alphabetic";
    const tip = { x: s.x + f.x * 4, z: s.z + f.z * 4 };
    ctx.strokeStyle = COLORS.start; line(s.x + f.x * (rr / k), s.z + f.z * (rr / k), tip.x, tip.z);
    if (sel === "start") handle(tip.x, tip.z, COLORS.start);
    ctx.restore();
  });
  if (S.addStart && pointer.inside) {
    ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = COLORS.start; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, Math.max(13, 0.45 * k), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
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
  if (S.addSpot && pointer.inside) {
    ctx.globalAlpha = 0.7; ctx.strokeStyle = SPOT_COLOR; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, Math.max(12, 0.45 * S.view.k), 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
}

// bot-walls-v1: the part of a bot's line that goes through a wall in red with an X where it hits; a strafer's
// width beyond its free room in red too (it is limited to that room when played).
function drawWallHits(it) {
  const info = wallInfo(it);
  if (!info) return;
  const red = "#ff3040";
  ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = red;
  for (const hh of info.hits) {
    ctx.lineWidth = 3.5; line(hh.hit.x, hh.hit.z, hh.b.x, hh.b.z);
    const [hx, hy] = pt(hh.hit.x, hh.hit.z);
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx + 6, hy + 6); ctx.moveTo(hx + 6, hy - 6); ctx.lineTo(hx - 6, hy + 6); ctx.stroke();
  }
  if (info.room && info.room.limited) {
    const u = strafeAxis(it, S.drill.start), half = (it.width || 3) / 2, keep = info.room.width / 2;
    ctx.lineWidth = 3.5;
    for (const sg of [-1, 1]) line(it.x + u.x * keep * sg, it.z + u.z * keep * sg, it.x + u.x * half * sg, it.z + u.z * half * sg);
  }
  ctx.restore();
}

// A bot's extra random spots: dashed purple rings (and routes), "spot 2", "spot 3"...
const SPOT_COLOR = "#b98cff";
// A trade: a red dashed arrow from the bot you kill to the bot that then swings, "trades 0.3–1.0 s".
function drawTrade(it, isSel) {
  const from = tradeTarget(S.drill, it);
  if (!from) return;
  const to = it.route ? it.route[it.move === "peek" ? 1 : 0] : it;
  ctx.save();
  ctx.globalAlpha = isSel ? 0.95 : 0.55;
  ctx.strokeStyle = "#ff6b7a"; ctx.lineWidth = isSel ? 2 : 1.4; ctx.setLineDash([6, 4]);
  line(from.x, from.z, to.x, to.z); ctx.setLineDash([]);
  arrow(from, to, "#ff6b7a");
  const [qx, qy] = pt((from.x + to.x) / 2, (from.z + to.z) / 2);
  ctx.fillStyle = "#ffb3bb"; ctx.font = "700 11px Bahnschrift, Segoe UI"; ctx.textAlign = "center";
  ctx.fillText(`trades ${(it.tradeMin ?? 0.3).toFixed(1)}–${(it.tradeMax ?? 1).toFixed(1)} s`, qx, qy - 6);
  ctx.restore();
}

// A bot's random zone: a purple area around its spot (a peeker's: around its peek spot, one per
// spot). Only the area is drawn; the points it uses are picked in the game or at Play, never here.
function drawZones(it, isSel) {
  if (!hasZone(it)) return;
  const spots = canRandomSpot(it) ? [{ x: it.x, y: it.y, z: it.z, route: it.route, ...(isDot(it) ? { wall: it.wall, facing: it.facing, dotHeight: it.dotHeight } : {}) }, ...(it.spots || [])] : [it];
  ctx.save();
  for (const s of spots) {
    if (it.move === "peek" && !(s.route && s.route[1])) continue;
    const c = zoneCorners(it, S.drill.start, s);
    ctx.beginPath();
    c.forEach((p, i) => (i ? ctx.lineTo(...pt(p.x, p.z)) : ctx.moveTo(...pt(p.x, p.z))));
    ctx.closePath();
    ctx.fillStyle = isSel ? "rgba(185,140,255,.16)" : "rgba(185,140,255,.08)";
    ctx.fill();
    ctx.strokeStyle = SPOT_COLOR; ctx.globalAlpha = isSel ? 0.95 : 0.5; ctx.lineWidth = isSel ? 2 : 1.4; ctx.setLineDash([3, 4]);
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (isSel) {
      const [qx, qy] = pt((c[0].x + c[1].x) / 2, (c[0].z + c[1].z) / 2);
      ctx.fillStyle = SPOT_COLOR; ctx.font = "700 11px Bahnschrift, Segoe UI"; ctx.textAlign = "center";
      ctx.fillText(it.move === "peek" ? "random peek zone" : zoneOnWall(it, s) ? "random zone on the wall" : "random zone", qx, qy - 6);
      if (zoneOnWall(it, s)) continue; // along its wall: nothing to turn
      // Turn handle: a line from the middle to a round handle past the end of the width; drag it to turn the zone.
      const mid = zoneCenter(it, s), hnd = zoneTurnHandle(it, S.drill.start, s);
      ctx.strokeStyle = SPOT_COLOR; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]);
      line(mid.x, mid.z, hnd.x, hnd.z); ctx.setLineDash([]);
      handle(hnd.x, hnd.z, SPOT_COLOR, "⟳");
    }
  }
  ctx.restore();
}

// bad(x, z): true off the map's floor (paint()'s helper), drawn red like other points.
function drawSpots(it, isSel, bad = () => false) {
  if (!canRandomSpot(it) || !Array.isArray(it.spots) || !it.spots.length) return;
  const k = S.view.k, r = Math.max(12, 0.45 * k);
  ctx.save();
  ctx.globalAlpha = isSel ? 0.95 : 0.5;
  ctx.font = "700 11px Bahnschrift, Segoe UI"; ctx.textAlign = "center";
  const ring = (x, z, text) => {
    const [qx, qy] = pt(x, z);
    ctx.strokeStyle = SPOT_COLOR; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(qx, qy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = SPOT_COLOR; ctx.fillText(text, qx, qy - r - 5);
  };
  if (isSel) ring(it.x, it.z, "spot 1");
  it.spots.forEach((s, j) => {
    const picked = isSel && S.spotSel && S.spotSel.id === it.id && S.spotSel.index === j;
    if (picked) { const [qx, qy] = pt(s.x, s.z); ctx.fillStyle = "rgba(185,140,255,.22)"; ctx.beginPath(); ctx.arc(qx, qy, r, 0, Math.PI * 2); ctx.fill(); }
    if (s.route) {
      ctx.strokeStyle = SPOT_COLOR; ctx.lineWidth = isSel ? 2 : 1.4; ctx.setLineDash([6, 5]);
      ctx.beginPath();
      s.route.forEach((p, i) => (i ? ctx.lineTo(...pt(p.x, p.z)) : ctx.moveTo(...pt(p.x, p.z))));
      if (it.move === "patrol" && s.route.length > 2) ctx.lineTo(...pt(s.route[0].x, s.route[0].z));
      ctx.stroke(); ctx.setLineDash([]);
      if (isSel) s.route.forEach((p, i) => handle(p.x, p.z, bad(p.x, p.z) ? COLORS.bad : SPOT_COLOR, String(i + 1)));
    } else if (isSel) handle(s.x, s.z, bad(s.x, s.z) ? COLORS.bad : SPOT_COLOR);
    if (it.move === "copycat" && it.track) {
      // Its run from this spot, faint purple (the game turns it toward your start, like at its own spot).
      const f = copycatFrames({ ...it, x: s.x, y: s.y, z: s.z }, S.drill.start);
      if (f) {
        ctx.strokeStyle = SPOT_COLOR; ctx.lineWidth = 1.4; ctx.setLineDash([3, 4]);
        ctx.beginPath();
        for (let i = 0; i < f.length; i += 6) (i ? ctx.lineTo(...pt(f[i], f[i + 2])) : ctx.moveTo(...pt(f[i], f[i + 2])));
        ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (it.move === "peek" && it.peekStrafe && s.route && s.route[1]) {
      // Its A-D strafe at this spot's peek point: its own width (drag the dots) or the bot's.
      const sp = s.route[1], a = across(it, sp), half = spotPeekWidth(it, s) / 2;
      const p1 = { x: sp.x - a.x * half, z: sp.z - a.z * half }, p2 = { x: sp.x + a.x * half, z: sp.z + a.z * half };
      ctx.strokeStyle = SPOT_COLOR; ctx.lineWidth = 2; ctx.setLineDash(it.peekStrafe === "random" ? [5, 4] : []);
      line(p1.x, p1.z, p2.x, p2.z); ctx.setLineDash([]);
      if (isSel) { handle(p1.x, p1.z, COLORS.route); handle(p2.x, p2.z, COLORS.route); }
    }
    ring(s.x, s.z, isSel ? `${itemName(S.drill, it)} · spot ${j + 2}` : `spot ${j + 2}`);
  });
  ctx.restore();
}

// Bot panel: "Random zone" (holders, strafers, peekers): it shows up anywhere inside an area, so
// even the person who built the drill doesn't know the exact spot.
function randomZoneGroup(b) {
  if (!ZONE_MOVES.has(b.move)) return null;
  const z = b.zone || { on: false, w: 6, d: 2 };
  const set = (fn) => (v) => edit(mod((it) => { it.zone = { ...(it.zone || { on: false, w: 6, d: 2 }) }; fn(it.zone, v); }));
  if (b.move === "peek" && b.trigger) return h("div", { class: "group" }, field("Random zone", h("p", { class: "help" }, "Not with a trigger line on a peeker. Remove the trigger to use a random peek zone.")));
  if (b.move === "peek" && b.tradeOf) return h("div", { class: "group" }, field("Random zone", h("p", { class: "help" }, "Not on a peeker that trades: it swings from its own spot. Holders and strafers that trade can use a zone.")));
  const peek = b.move === "peek", wallZone = zoneOnWall(b);
  if (wallZone) {
    // dot-spots-v1: a dot stuck on a wall: the zone lies on the wall.
    const wk = [field("Random zone", seg([[false, "Off"], [true, "On"]], !!z.on, set((zz, v) => (zz.on = v))),
      z.on ? "Each time it shows up it sticks to a random point of this wall inside the purple line: anywhere along it and up or down. Points past the wall's end are never used." : "Off: it uses the exact spot you placed. On: anywhere on this wall inside an area.")];
    if (z.on) wk.push(
      field("Along the wall", slider(1, 20, 0.5, z.w ?? 6, metres, (dd, v) => mod((it) => { it.zone = { ...it.zone, w: v }; })(dd))),
      field("Up and down", slider(0, 10, 0.5, z.d ?? 2, metres, (dd, v) => mod((it) => { it.zone = { ...it.zone, d: v }; })(dd)), `Around its height (${dotHeight(b).toFixed(1)} m). 0 keeps it at that height.`));
    return h("div", { class: "group" }, ...wk);
  }
  const kids = [field("Random zone", seg([[false, "Off"], [true, "On"]], !!z.on, set((zz, v) => (zz.on = v))),
    z.on
      ? (peek
        ? "Each peek swings out to a random point in the purple area. Cover stays where you put it. The Studio picks 12 hidden points each time you press Play; you only see the area."
        : "Each time it shows up it stands at a new random point in the purple area (never the same spot twice in a row). You only see the area, not where it will be.")
      : "Off: it uses the exact spot you placed. On: anywhere inside an area, so you can't know where it will be.")];
  if (z.on) kids.push(
    field("Zone width", slider(1, 20, 0.5, z.w ?? 6, metres, (dd, v) => mod((it) => { it.zone = { ...it.zone, w: v }; })(dd)), "Across your view."),
    field("Zone depth", slider(0, 10, 0.5, z.d ?? 2, metres, (dd, v) => mod((it) => { it.zone = { ...it.zone, d: v }; })(dd)), "Toward and away from you. 0 keeps it on one line."),
    field("Zone turn", slider(-90, 90, 1, zoneTurn(b), (v) => `${v > 0 ? "+" : ""}${Math.round(v)}°`, (dd, v) => mod((it) => { it.zone = { ...it.zone, turn: v }; })(dd)),
      "0° is square to your view. Or drag the round ⟳ handle at the end of the zone on the map."));
  return h("div", { class: "group" }, ...kids);
}

// Bot panel: "Random spots" (extra places it can show up, one picked at random each time).
function randomSpotsGroup(b) {
  const extra = (b.spots || []).length;
  // Bots with a trigger line or a trade, and copycats, never take turns.
  const turns = takingTurns() && !b.trigger && !b.tradeOf && b.move !== "copycat";
  const what = b.move === "peek" ? "peek" : b.move === "cross" || b.move === "patrol" ? "run" : "time it shows up";
  const help = extra
    ? `${extra + 1} spots. Each ${what} uses one of them at random, never the same one twice in a row${turns ? (S.drill.round.goal === "clear" ? " (Clear them all with bots taking turns: one spot is picked each time you press Play)" : " (in a take-turns round each spot is one more turn it can take)") : ""}. Drag a purple spot to move it with its route (Ctrl+drag point 1 to move only that point); right-click one to remove that spot.`
    : `Only this spot. Add spots and it shows up at a different one each ${what}, so you can't pre-aim from memory.`;
  const note = !extra ? ""
    : b.tradeOf ? " Each trade swings from one of its spots."
    : b.trigger ? " Nothing shows up until you cross its line; then it uses a random spot each time."
    : b.move === "copycat" ? " It runs your recording from the spot it got, turned toward your start like at its own spot. Its first run starts with the round; after a kill it comes back at another spot (Comes back after)."
    : !turns && b.move !== "peek" ? " After a kill it comes back at another spot (Comes back after). Its first appearance is a moment after the round starts." : "";
  return h("div", { class: "group" }, field("Random spots", h("div", {},
    h("p", { class: "help" }, help + note),
    isDot(b) && extra ? dotSpotRows(b) : null,
    isDot(b) && extra ? h("p", { class: "help" }, "Height of each spot (middle of the ball above the floor). In 3D, select the dot and drag the white arrows on a purple spot.") : null,
    h("div", { class: "btn-row" },
      h("button", { class: "btn small" + (S.addSpot ? " primary" : ""), onclick: () => { S.addSpot = !S.addSpot; S.addPoint = false; S.tool = null; renderSide(); draw(); } }, ic("plus"), S.addSpot ? "Click the map… (Esc to stop)" : "Add a spot"),
      extra ? h("button", { class: "btn small", onclick: () => removeSpot(b, extra - 1) }, ic("minus"), "Remove last spot") : null))));
}

// dot-spots-v2: a dot spot's height (its own, else the dot's).
const spotHeight = (b, s) => (s && Number.isFinite(s.dotHeight) ? s.dotHeight : dotHeight(b));
function dotSpotRows(b) {
  const step = (j, dir) => (e) => edit(mod((it) => { const s = it.spots && it.spots[j]; if (s) s.dotHeight = Math.round(Math.max(0.2, Math.min(DOT_MAX_HEIGHT, spotHeight(it, s) + dir * (e.shiftKey ? 1 : 0.1))) * 100) / 100; }));
  return h("div", { class: "dot-spot-rows" }, (b.spots || []).map((s, j) => {
    const picked = S.spotSel && S.spotSel.id === b.id && S.spotSel.index === j;
    return h("div", { class: "dot-height" + (picked ? " picked" : "") },
      h("span", { class: "dot-spot-name" }, `Spot ${j + 2}`, h("small", {}, s.wall && Number.isFinite(s.wall.x) ? " · on a wall" : " · floating")),
      h("button", { type: "button", class: "btn small", title: "Lower (Shift: 1 m)", onclick: step(j, -1) }, "▼"),
      h("b", {}, `${spotHeight(b, s).toFixed(1)} m`),
      h("button", { type: "button", class: "btn small", title: "Higher (Shift: 1 m)", onclick: step(j, 1) }, "▲"));
  }));
}
// dot-spots-v1: puts a dot's spot at `at` the way a dot is placed (sticks to a wall face near it; free = Alt).
function placeDotSpot(b, spot, at, free = false, dragging = false) {
  const tmp = { ...b, x: spot.x ?? b.x, y: spot.y ?? b.y, z: spot.z ?? b.z, ...dotSpotFields(b, spot) };
  if (!("dotHeight" in spot)) tmp.dotHeight = dotHeight(b);
  setDotSpot(tmp, at, S.drill, free, dragging);
  Object.assign(spot, { x: tmp.x, y: tmp.y, z: tmp.z, wall: tmp.wall || null, facing: tmp.facing ?? null, dotHeight: tmp.dotHeight });
  return spot;
}
// Drops a spot where you clicked: a copy of the bot (and its route) moved so its spot (point 1) is there.
function addSpotAt(b, at) {
  if (isDot(b)) {
    const spot = placeDotSpot(b, {}, at, !!at.free);
    edit(mod((it) => { it.spots = [...(it.spots || []), spot]; }));
    S.spotSel = { id: b.id, index: (b.spots || []).length };
    renderSide();
    return;
  }
  const ox = Math.round((at.x - b.x) * 10) / 10, oz = Math.round((at.z - b.z) * 10) / 10;
  const move = (p) => { const x = Math.round((p.x + ox) * 10) / 10, z = Math.round((p.z + oz) * 10) / 10; return { ...p, x, z, y: floorAt(x, z, at.y ?? p.y) ?? p.y }; };
  const spot = b.route ? { route: b.route.map(move) } : move({ x: b.x, y: b.y, z: b.z });
  if (spot.route) Object.assign(spot, { x: spot.route[0].x, y: spot.route[0].y, z: spot.route[0].z });
  edit(mod((it) => { it.spots = [...(it.spots || []), spot]; }));
  S.spotSel = { id: b.id, index: (b.spots || []).length };
  renderSide();
}
// Removes the spot Backspace / Del points at, then points at the one before it (so pressing again clears them).
let spotRemovedAt = 0;
function removeSpotKey() {
  const it = selItem();
  const spots = it && it.kind === "bot" && Array.isArray(it.spots) ? it.spots : [];
  const index = S.spotSel && it && S.spotSel.id === it.id ? S.spotSel.index : S.addSpot ? spots.length - 1 : -1;
  if (index < 0 || index >= spots.length) return false;
  removeSpot(it, index);
  S.spotSel = spots.length > 1 ? { id: it.id, index: Math.max(0, index - 1) } : null;
  spotRemovedAt = performance.now();
  draw();
  return true;
}
// Adds a spot beside the last one (a copy of the bot's route moved 2.5 m across your view).
function addSpot(b) {
  const last = b.spots && b.spots.length ? b.spots[b.spots.length - 1] : { x: b.x, y: b.y, z: b.z, route: b.route };
  const a = across(b);
  const ox = Math.round(a.x * 2.5 * 10) / 10, oz = Math.round(a.z * 2.5 * 10) / 10;
  const move = (p) => { const x = Math.round((p.x + ox) * 10) / 10, z = Math.round((p.z + oz) * 10) / 10; return { ...p, x, z, y: floorAt(x, z, p.y) ?? p.y }; };
  const base = move(last);
  if (isDot(b)) { const spot = placeDotSpot(b, { ...dotSpotFields(b, last) }, { x: base.x, z: base.z }); edit(mod((it) => { it.spots = [...(it.spots || []), spot]; })); return; }
  const spot = { x: base.x, y: base.y, z: base.z, ...(b.route ? { route: (last.route || b.route).map(move) } : {}) };
  if (spot.route) Object.assign(spot, { x: spot.route[0].x, y: spot.route[0].y, z: spot.route[0].z });
  edit(mod((it) => { it.spots = [...(it.spots || []), spot]; }));
}
function removeSpot(b, index) {
  edit((d) => { const it = d.items.find((i) => i.id === b.id); it.spots = (it.spots || []).filter((_, j) => j !== index); });
  renderSide();
}

// A copycat's recorded run: the path, white dots where it jumps, red dots where you fired.
function drawRun(it, isSel) {
  const f = copycatFrames(it, S.drill.start);
  if (!f) return;
  const color = isSel ? COLORS.route : "rgba(255,181,71,.55)";
  ctx.strokeStyle = color;
  ctx.lineWidth = isSel ? 2.5 : 1.6;
  ctx.beginPath();
  for (let i = 0; i < f.length; i += 6) (i ? ctx.lineTo(...pt(f[i], f[i + 2])) : ctx.moveTo(...pt(f[i], f[i + 2])));
  ctx.stroke();
  for (let i = 6; i < f.length; i += 6) {
    const jump = f[i + 5] && !f[i - 1], shot = f[i + 4] && !f[i - 2];
    if (!jump && !shot) continue;
    ctx.fillStyle = jump ? "#ffffff" : "#ff4655";
    ctx.beginPath(); ctx.arc(...pt(f[i], f[i + 2]), isSel ? 4 : 3, 0, Math.PI * 2); ctx.fill();
  }
  if (f.length >= 12 && it.playback !== "loop") arrow({ x: f[f.length - 12], z: f[f.length - 10] }, { x: f[f.length - 6], z: f[f.length - 4] }, color);
  // Where its smokes land: a soft circle the size of a Cloudburst smoke (3.35 m).
  const sm = copycatSmokes(it, S.drill.start);
  if (sm) {
    ctx.fillStyle = isSel ? "rgba(200,225,245,.35)" : "rgba(200,225,245,.18)";
    ctx.strokeStyle = "rgba(200,225,245,.7)"; ctx.lineWidth = 1;
    for (let i = 0; i + 3 < sm.length; i += 4) {
      ctx.beginPath(); ctx.arc(...pt(sm[i + 1], sm[i + 3]), 3.35 * S.view.k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
}

function body(it, at, isSel, isBad) {
  const k = S.view.k;
  if (isDot(it)) {
    // dot-bots-v1: the ball, its real size (at least 6 px), in the targets color, with a dashed ring so it reads as a bot.
    const [x, y] = pt(at.x, at.z), r = Math.max(6, dotRadius(it) * k);
    ctx.fillStyle = isBad ? "#5a1b22" : targetColor(S.drill);
    ctx.strokeStyle = isSel ? "#fff" : isBad ? COLORS.bad : "#ff4655"; ctx.lineWidth = isSel ? 3 : 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = isSel ? "rgba(255,255,255,.8)" : "rgba(255,70,85,.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, Math.max(9, 0.45 * k), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    return;
  }
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
    // A peeker turns from its peek spot (point 2), not from cover.
    const o = it.move === "peek" ? turnFrom(it) : at, [ox, oy] = o === at ? [x + fx * r, y + fy * r] : pt(o.x, o.z);
    const tip = { x: o.x + w.x * 2.2, z: o.z + w.z * 2.2 };
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(...pt(tip.x, tip.z)); ctx.stroke();
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
// studio-arena-rect: resize arrows in 2D. Each handle: a world point on an edge / face, the outward
// direction, and what it changes. Drawn as a double arrow across the edge.
function arenaHandles() {
  if (!S.drill || onMap()) return [];
  const r = arenaRect(S.drill), cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  return [
    { side: "x0", x: r.x0, z: cz, dir: { x: -1, z: 0 } }, { side: "x1", x: r.x1, z: cz, dir: { x: 1, z: 0 } },
    { side: "z0", x: cx, z: r.z0, dir: { x: 0, z: -1 } }, { side: "z1", x: cx, z: r.z1, dir: { x: 0, z: 1 } },
  ];
}
function blockHandles(b) {
  const a = (b.turn || 0) * Math.PI / 180, u = { x: Math.cos(a), z: -Math.sin(a) }, v = { x: Math.sin(a), z: Math.cos(a) };
  const out = [];
  const add = (dimension, axis, sign, half) => out.push({ dimension, sign, x: b.x + axis.x * half * sign, z: b.z + axis.z * half * sign, dir: { x: axis.x * sign, z: axis.z * sign } });
  for (const s of [-1, 1]) add("w", u, s, b.w / 2);
  if (b.shape !== "pillar") for (const s of [-1, 1]) add("d", v, s, b.d / 2);
  return out;
}
function handleArrow(x, z, dx, dz, active) {
  const [px, py] = pt(x, z), [qx, qy] = pt(x + dx, z + dz);
  let ux = qx - px, uy = qy - py; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  const nx = -uy, ny = ux, len = 15, head = 7;
  ctx.save();
  ctx.fillStyle = active ? "#ff4655" : "rgba(10,14,20,.85)";
  ctx.strokeStyle = active ? "#fff" : "#ff4655";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px - ux * (len - head), py - uy * (len - head)); ctx.lineTo(px + ux * (len - head), py + uy * (len - head)); ctx.stroke();
  for (const s of [1, -1]) {
    const tx = px + ux * len * s, ty = py + uy * len * s;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.lineTo(tx - ux * head * s + nx * head * .7, ty - uy * head * s + ny * head * .7);
    ctx.lineTo(tx - ux * head * s - nx * head * .7, ty - uy * head * s - ny * head * .7);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// Which way the cursor points for a handle (screen direction of the world direction).
function resizeCursor(h) {
  const [px, py] = pt(h.x, h.z), [qx, qy] = pt(h.x + h.dir.x, h.z + h.dir.z);
  const ang = Math.abs(Math.atan2(qy - py, qx - px) * 180 / Math.PI) % 180;
  return ang < 22.5 || ang > 157.5 ? "ew-resize" : ang < 67.5 ? "nwse-resize" : ang < 112.5 ? "ns-resize" : "nesw-resize";
}

function drawBlock(b, isSel, isBad) {
  const hw = b.w / 2, hd = b.d / 2;
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => pt(...Object.values(blockToWorld(b, lx, lz))));
  const path = () => { ctx.beginPath(); corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  ctx.globalAlpha = b.invisible ? 0.16 : b.shape === "floor" ? 0.75 : 0.9;
  ctx.fillStyle = b.invisible ? "#7fd8ff" : surfaceFor(S.drill,b,b.shape==='floor').color;
  if (b.shape === "pillar") { ctx.beginPath(); ctx.arc(...pt(b.x, b.z), (b.w / 2) * S.view.k, 0, Math.PI * 2); ctx.fill(); }
  else if (b.shape !== "room") { path(); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = isBad ? COLORS.bad : isSel ? "#fff" : b.invisible ? "#7fd8ff" : "rgba(10,17,24,.9)";
  ctx.lineWidth = isSel ? 2.5 : 1.5;
  if (b.invisible) ctx.setLineDash([8, 6]);
  if (b.shape === "pillar") { ctx.beginPath(); ctx.arc(...pt(b.x, b.z), (b.w / 2) * S.view.k, 0, Math.PI * 2); ctx.stroke(); }
  else { path(); ctx.stroke(); }
  ctx.setLineDash([]);
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
    const g = gameBlock(b, b.id, 0).hole.width / 2;
    ctx.strokeStyle = b.shape === "window" ? "#7fd8ff" : "#0a1118"; ctx.lineWidth = Math.max(3, b.d * S.view.k);
    L(-g, 0, g, 0);
  }
  if (b.shape === "room") {
    ctx.strokeStyle = surfaceFor(S.drill,b,b.shape==='floor').color; ctx.lineWidth = Math.max(4, 0.3 * S.view.k);
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
  if (isSel && S.group.length < 2) for (const h of blockHandles(b)) handleArrow(h.x, h.z, h.dir.x, h.dir.z, drag && drag.type === "blockSide" && drag.dimension === h.dimension && drag.sign === h.sign);
}

// A bot's trigger line: it shows up when you walk across it. Yellow, with a faint link to its bot.
const TRIGGER = "#ffd84a";
function drawTrigger(it, isSel) {
  const { a, b } = it.trigger, m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  ctx.strokeStyle = "rgba(255,216,74,.35)"; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
  line(m.x, m.z, it.x, it.z);
  ctx.strokeStyle = isSel ? TRIGGER : "rgba(255,216,74,.6)"; ctx.lineWidth = isSel ? 3.5 : 2.5; ctx.setLineDash(isSel ? [] : [7, 4]);
  line(a.x, a.z, b.x, b.z);
  ctx.setLineDash([]);
  if (isSel) { handle(a.x, a.z, TRIGGER); handle(b.x, b.z, TRIGGER); }
  if (isSel || S.view.k >= 5) {
    const [px, py] = pt(m.x, m.z);
    ctx.font = "700 11px Bahnschrift, Segoe UI"; ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = "#0a1118"; ctx.fillStyle = TRIGGER;
    const text = `cross → ${itemName(S.drill, it)}${it.delay ? ` (+${it.delay.toFixed(1)} s)` : ""}`;
    ctx.strokeText(text, px, py - 9); ctx.fillText(text, px, py - 9);
  }
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
  if (S.preview) {
    const focus = previewFocus();
    html = (focus ? `Previewing <b>${[...focus].length === 1 ? itemName(S.drill, S.drill.items.find((i) => i.id === [...focus][0])) : `${focus.size} bots`}</b> · click empty map to preview all` : "Previewing <b>all bots</b> · select one bot or Shift-select a few to preview only them")
      + ` · trades: the traded bot dies ${TRADE_KILL} s in · trigger lines: you cross ${TRIGGER_AT} s in`;
  } else if (S.tool) {
    const name = S.tool.kind === "bot" ? MOVES[S.tool.move].short : S.tool.kind === "block" ? BLOCK_SHAPES[S.tool.move].label.toLowerCase() : { targets: "target zone", wall: "wall", barrier: "invisible wall", airfloor: "invisible floor", smoke: "smoke", start: "your start", dot: "a dot" }[S.tool.kind];
    html = `Click the map to place <b>${name}</b> · Shift-click to place more · <span class="kbd">Esc</span> cancel`;
  } else if (S.group.length > 1) {
    html = `<b>${S.group.length} selected</b> · drag one to move them all · Shift-click to add/remove · <span class="kbd">Del</span> remove all · <span class="kbd">Esc</span> clear`;
  } else if (S.addStart && S.sel === "start") {
    html = `Click the map to drop another start · Shift-click to drop more · <span class="kbd">Backspace</span> removes the last · <span class="kbd">Esc</span> stop`;
  } else if (S.addSpot && it) {
    html = `Click the map to drop a spot for <b>${itemName(S.drill, it)}</b> · Shift-click to drop more · <span class="kbd">Backspace</span> removes the last · <span class="kbd">Esc</span> stop`;
  } else if (S.addPoint && it) {
    html = `Click the map to add route points to <b>${itemName(S.drill, it)}</b> · <span class="kbd">Esc</span> when done`;
  } else if (it && it.route) {
    html = "Drag the numbered points to shape the route · right-click a point to remove it";
  } else if (it && S.mode3d && (it.kind === 'block' || it.kind === 'wall')) {
    html = 'Edges and heights snap together · arrows resize · drag the arrow to rotate · <span class="kbd">Alt</span> free adjustment';
  } else if (it) {
    html = "Drag to move · <span class=\"kbd\">Del</span> remove · <span class=\"kbd\">Ctrl</span>+<span class=\"kbd\">D</span> copy";
  } else if (S.sel === "start") {
    html = "Drag to move · drag the green dot to turn where you look";
  } else {
    html = S.mode3d
      ? "Pick something on the left, then click in the world · drag empty space to turn the camera · WASD or right-drag to move, Space up, Ctrl down (Shift: faster) · scroll to zoom"
      : "Pick a bot on the left, then click the map · scroll to zoom · drag empty space to move around";
  }
  if (hintEl.dataset.html !== html) { hintEl.dataset.html = html; hintEl.innerHTML = html; }
  stage.classList.toggle("placing", !!S.tool || S.addPoint || S.addSpot || S.addStart);
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
  // studio-arena-rect: resize arrows of a selected piece, then the arena's edge arrows.
  if (it && it.kind === "block" && S.group.length < 2) for (const h of blockHandles(it)) if (near(h.x, h.z, 14)) return { type: "blockSide", item: it, dimension: h.dimension, sign: h.sign, dir: h.dir, cursor: resizeCursor(h) };
  for (const h of arenaHandles()) if (near(h.x, h.z, 14)) return { type: "arenaEdge", side: h.side, cursor: resizeCursor(h) };
  const st = d.start, look = dirOf(st.facing);
  if (near(st.x + look.x * 4, st.z + look.z * 4, 10)) return { type: "turn" };
  const starts = Array.isArray(st.spots) ? st.spots : [];
  if (S.sel === "start") for (let j = starts.length - 1; j >= 0; j--) {
    const f = dirOf(starts[j].facing ?? st.facing);
    if (near(starts[j].x + f.x * 4, starts[j].z + f.z * 4, 10)) return { type: "startSpotTurn", index: j };
  }
  for (let j = starts.length - 1; j >= 0; j--) if (near(starts[j].x, starts[j].z, Math.max(14, 0.45 * S.view.k))) return { type: "startSpot", index: j };
  if (it) {
    if (fixedFacing(it)) {
      const f = dirOf(fixedYaw(it));
      const o = turnFrom(it);
      if (near(o.x + f.x * 2.2, o.z + f.z * 2.2, 10)) return { type: "botTurn", item: it };
    }
    if (it.trigger) for (const end of ["a", "b"]) if (near(it.trigger[end].x, it.trigger[end].z, 11)) return { type: "trigEnd", item: it, end };
    const star = it.flash && it.flash.on ? flashTarget(it, d.start) : null;
    if (star && near(star.x, star.z, 12)) return { type: "flash", item: it };
    if (hasZone(it)) {
      const spots = canRandomSpot(it) ? [{ x: it.x, y: it.y, z: it.z, route: it.route, ...(isDot(it) ? { wall: it.wall, facing: it.facing, dotHeight: it.dotHeight } : {}) }, ...(it.spots || [])] : [it];
      for (const s of spots) {
        if (it.move === "peek" && !(s.route && s.route[1])) continue;
        if (zoneOnWall(it, s)) continue; // a wall zone has no turn handle
        const hnd = zoneTurnHandle(it, d.start, s);
        if (near(hnd.x, hnd.z, 11)) return { type: "zoneTurn", item: it, center: zoneCenter(it, s) };
      }
    }
    if (it.route) for (let i = it.route.length - 1; i >= 0; i--) if (near(it.route[i].x, it.route[i].z, 10)) return { type: "point", item: it, index: i };
    // A peeker's strafe dots at each extra spot (its own width) come before the spot itself: they often
    // sit on the spot's dashed route.
    if (it.move === "peek" && it.peekStrafe && Array.isArray(it.spots)) for (let j = it.spots.length - 1; j >= 0; j--) {
      const q = it.spots[j], qp = q.route && q.route[1];
      if (!qp) continue;
      const qa = across(it, qp), qh = spotPeekWidth(it, q) / 2;
      for (const s of [-1, 1]) if (near(qp.x + qa.x * qh * s, qp.z + qa.z * qh * s, 9)) return { type: "spotPeekWidth", item: it, spot: j };
    }
    // An extra spot moves as a whole (its ring, point 1 or its dashed route), like dragging the bot;
    // points 2+ move on their own, and Ctrl+drag on point 1 moves only that point.
    if (canRandomSpot(it) && Array.isArray(it.spots)) for (let j = it.spots.length - 1; j >= 0; j--) {
      const s = it.spots[j];
      if (s.route) for (let i = s.route.length - 1; i >= 1; i--) if (near(s.route[i].x, s.route[i].z, 10)) return { type: "spotPoint", item: it, spot: j, index: i };
      if (near(s.x, s.z, Math.max(14, 0.45 * S.view.k + 2))) return { type: "spotMove", item: it, spot: j, index: s.route ? 0 : -1 };
      if (s.route) for (let i = 1; i < s.route.length; i++) {
        const a = s.route[i - 1], b = s.route[i];
        if (segDist(px, py, ...pt(a.x, a.z), ...pt(b.x, b.z)) < 6) return { type: "spotMove", item: it, spot: j, index: 0 };
      }
    }
    if (it.move === "strafe" || it.kind === "targets") {
      const a = across(it), half = it.width / 2;
      for (const s of [-1, 1]) if (near(it.x + a.x * half * s, it.z + a.z * half * s, 10)) return { type: "width", item: it };
    }
    if (it.move === "peek" && it.peekStrafe && it.route && it.route[1]) {
      const sp = it.route[1], a = across(it, sp), half = peekWidth(it) / 2;
      for (const s of [-1, 1]) if (near(sp.x + a.x * half * s, sp.z + a.z * half * s, 10)) return { type: "peekWidth", item: it };
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
  for (const i of items) if (i.kind === "bot" && i.trigger) {
    const { a, b } = i.trigger;
    if (segDist(px, py, ...pt(a.x, a.z), ...pt(b.x, b.z)) < 7) return { type: "item", item: i, trigLine: true };
  }
  for (const i of items) if (i.kind === "smoke" && near(i.x, i.z, Math.max(12, 4.5 * S.view.k))) return { type: "item", item: i };
  // Structures: the highest one under the pointer.
  const at = toWorld(px, py);
  const blocks = items.filter((i) => i.kind === "block" && blockHit(i, at.x, at.z)).sort((a, b) => (b.y + b.lift + b.h) - (a.y + a.lift + a.h));
  if (blocks.length) return { type: "item", item: blocks[0] };
  // Anywhere along an arena edge grabs that edge too.
  if (!onMap()) {
    const r = arenaRect(d), edge = (side, ax, az, bx, bz) => segDist(px, py, ...pt(ax, az), ...pt(bx, bz)) < 6 ? side : null;
    const side = edge("x0", r.x0, r.z0, r.x0, r.z1) || edge("x1", r.x1, r.z0, r.x1, r.z1) || edge("z0", r.x0, r.z0, r.x1, r.z0) || edge("z1", r.x0, r.z1, r.x1, r.z1);
    if (side) { const h = arenaHandles().find((q) => q.side === side); return { type: "arenaEdge", side, cursor: resizeCursor(h) }; }
  }
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
    else { const hov = S.tool || S.addPoint || S.addSpot ? null : hitTest(pointer.x, pointer.y); canvas.style.cursor = hov ? hov.cursor || "grab" : ""; }
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
      else if (hit && (hit.type === "spotPoint" || hit.type === "spotMove")) removeSpot(hit.item, hit.spot);
      else if (hit && hit.type === "startSpot") removeStart(hit.index);
      else drag = { type: "pan", px, py, cx: S.view.cx, cz: S.view.cz };
      return;
    }
    if (e.button !== 0) return;
    if (S.tool) { place(S.tool, at); if (!e.shiftKey) setTool(null); return; }
    const it = selItem();
    if (S.addPoint && it && it.route) { addPoint(it, at); return; }
    if (S.addSpot && it && it.kind === "bot") { addSpotAt(it, at); if (!e.shiftKey) { S.addSpot = false; renderSide(); } draw(); return; }
    if (S.addStart && S.sel === "start") { addStartAt(at); if (!e.shiftKey) { S.addStart = false; renderSide(); } draw(); return; }
    if (e.shiftKey) {
      // Shift-click a thing: add it to / take it out of the selection (handles don't count here).
      const keep = S.sel; S.sel = null;
      const thing = hitTest(px, py);
      S.sel = keep;
      if (thing && thing.type === "item" && !thing.trigLine) { toggleInGroup(thing.item.id); return; }
      if (!thing) { drag = { type: "box", px, py, bx: px, by: py, base: S.group.length > 1 ? [...S.group] : selItem() ? [S.sel] : [] }; draw(); return; }
    }
    let hit = hitTest(px, py);
    if (hit && hit.type === "spotMove" && e.ctrlKey && hit.index === 0) hit = { ...hit, type: "spotPoint" };
    S.spotSel = hit && (hit.type === "spotMove" || hit.type === "spotPoint") ? { id: hit.item.id, index: hit.spot } : null;
    // Grabbing a thing in the group moves the whole group; anything else ends the group.
    const groupGrab = !!(hit && hit.item && hit.type === "item" && inGroup(hit.item.id));
    if (groupGrab) S.sel = hit.item.id;
    else if (S.group.length) { S.group = []; if (hit && hit.item) S.sel = hit.item.id; renderSide(); }
    if (!hit) {
      if (S.sel !== null) { S.sel = null; S.addPoint = false; S.addSpot = false; renderSide(); }
      drag = { type: "pan", px, py, cx: S.view.cx, cz: S.view.cz };
      stage.classList.add("panning");
      draw();
      return;
    }
    const target = hit.item ? hit.item.id : hit.type === "start" || hit.type === "turn" || hit.type === "startSpot" || hit.type === "startSpotTurn" ? "start" : S.sel;
    S.startSel = hit.type === "startSpot" || hit.type === "startSpotTurn" ? hit.index : null;
    if (target !== S.sel) { S.sel = target; S.addPoint = false; S.addSpot = false; renderSide(); }
    const obj = hit.item || S.drill.start;
    drag = { ...hit, key: `drag-${Date.now()}`, dx: obj.x - at.x, dz: obj.z - at.z, moved: false, groupGrab,
      ...(hit.type === "spotMove" ? { ax: at.x, az: at.z, orig: structuredClone(hit.item.spots[hit.spot]) } : {}),
      baseY: obj.y, snapping: hit.type === "item" && !hit.trigLine ? createPieceSnap(S.drill.items, obj) : null,
      ...(hit.trigLine ? { ax: at.x, az: at.z, orig: structuredClone(hit.item.trigger) } : {}),
      ...(hit.type === "blockSide" ? { original: structuredClone(hit.item) } : {}) };
    draw();
  });
  const end = () => {
    if (drag && drag.type === "box") {
      // Everything whose spot is inside the box joins the selection.
      const x0 = Math.min(drag.px, drag.bx), x1 = Math.max(drag.px, drag.bx), y0 = Math.min(drag.py, drag.by), y1 = Math.max(drag.py, drag.by);
      const found = x1 - x0 < 4 && y1 - y0 < 4 ? [] : S.drill.items.filter((i) => { const [qx, qy] = pt(i.x, i.z); return qx >= x0 && qx <= x1 && qy >= y0 && qy <= y1; }).map((i) => i.id);
      if (found.length) setGroup([...drag.base, ...found]);
      renderSide();
    } else if (drag && drag.groupGrab && !drag.moved) {
      // A plain click on one thing of the group selects just that one.
      setGroup([drag.item.id]); renderSide();
    } else if (drag && drag.moved) renderSide();
    const handleDrag = drag && (drag.type === "arenaEdge" || drag.type === "blockSide");
    drag = null;
    stage.classList.remove("panning");
    if (handleDrag) draw(); // drop the "being resized" highlight
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
  if (drag.type === "box") { drag.bx = px; drag.by = py; return; }
  const at = at3 || toWorld(px, py);
  drag.moved = true;
  // at.stand: a spot the 3D view already put on standing ground (standOn), grid included.
  const snap = (v) => (at.stand ? Math.round(v * 100) / 100 : e.altKey ? v : Math.round(v * 10) / 10);
  edit((d) => {
    if (drag.type === "arenaEdge") {
      // studio-arena-rect: move one edge; the opposite edge stays. Whole half metres (Alt: free).
      const r = arenaRect(d), axis = drag.side[0], v = e.altKey ? at[axis] : Math.round(at[axis] * 2) / 2;
      r[drag.side] = drag.side[1] === "0" ? Math.min(v, r[axis + "1"] - ARENA_MIN) : Math.max(v, r[axis + "0"] + ARENA_MIN);
      delete d.arenaSize;
      setArenaRect(d, r);
    } else if (drag.type === "blockSide") {
      const it = d.items.find((i) => i.id === drag.item.id), o = drag.original;
      if (it) {
        const face = blockHandles(o).find((h) => h.dimension === drag.dimension && h.sign === drag.sign);
        let delta = (at.x - face.x) * drag.dir.x + (at.z - face.z) * drag.dir.z;
        if (o.shape === "pillar") delta *= 2; // a pillar grows on both sides
        resizePiece(it, o, drag.dimension, drag.sign, delta, e.altKey);
      }
    } else if (drag.type === "turn") {
      d.start.facing = Math.round(yawDeg(d.start, at));
    } else if (drag.type === "start") {
      d.start.x = snap(at.x + drag.dx); d.start.z = snap(at.z + drag.dz);
      d.start.y = floorAt(d.start.x, d.start.z, at.y ?? d.start.y) ?? d.start.y;
    } else if (drag.type === "item" && drag.trigLine) {
      // Dragging the trigger line itself moves the whole line, not the bot.
      const it = d.items.find((i) => i.id === drag.item.id);
      const ox = at.x - drag.ax, oz = at.z - drag.az;
      for (const end of ["a", "b"]) it.trigger[end] = { x: snap(drag.orig[end].x + ox), z: snap(drag.orig[end].z + oz) };
    } else if (drag.type === "item" && isDot(drag.item) && !drag.groupGrab) {
      const it = d.items.find((i) => i.id === drag.item.id);
      setDotSpot(it, at.dotHit ? at : { x: snap(at.x + drag.dx), z: snap(at.z + drag.dz) }, d, e.altKey, true);
    } else if (drag.type === "item") {
      const it = d.items.find((i) => i.id === drag.item.id);
      const oldX = it.x, oldZ = it.z, oldY = it.y ?? 0;
      it.x = snap(at.x + drag.dx); it.z = snap(at.z + drag.dz);
      if (drag.snapping) {
        it.y = drag.baseY;
        drag.snapping.move(it, e.altKey);
      } else {
        it.y = floorAt(it.x, it.z, at.y ?? it.y, it.kind === "block" ? it.id : undefined) ?? it.y;
      }
      const ox = it.x - oldX, oz = it.z - oldZ;
      if (inGroup(it.id)) {
        // The whole group moves by the same amount, each with its route, spots, trigger line and flash target.
        if (Array.isArray(it.spots)) for (const s of it.spots) { s.x = snap(s.x + ox); s.z = snap(s.z + oz); if (s.route) for (const p of s.route) { p.x = snap(p.x + ox); p.z = snap(p.z + oz); } }
        if (it.trigger) for (const end of ["a", "b"]) it.trigger[end] = { x: snap(it.trigger[end].x + ox), z: snap(it.trigger[end].z + oz) };
        for (const o of d.items) if (o.id !== it.id && inGroup(o.id)) shiftItem(o, ox, oz);
      }
      // The route goes up or down with the bot (onto a box, off a ledge), each point to the floor nearest that height.
      const oy = at.stand ? (it.y ?? 0) - oldY : 0;
      if (it.route) for (const p of it.route) { p.x = snap(p.x + ox); p.z = snap(p.z + oz); p.y = floorAt(p.x, p.z, (p.y ?? 0) + oy) ?? p.y; }
      if (it.flash && it.flash.target) it.flash.target = { x: snap(it.flash.target.x + ox), z: snap(it.flash.target.z + oz) };
    } else if (drag.type === "botTurn") {
      const it = d.items.find((i) => i.id === drag.item.id);
      it[it.move === "peek" ? "peekFacing" : "facing"] = Math.round(yawDeg(turnFrom(it), at));
    } else if (drag.type === "trigEnd") {
      const it = d.items.find((i) => i.id === drag.item.id);
      it.trigger[drag.end] = { x: snap(at.x), z: snap(at.z) };
    } else if (drag.type === "flash") {
      const it = d.items.find((i) => i.id === drag.item.id);
      it.flash.target = { x: snap(at.x), z: snap(at.z) }; // phoenix-control-v1: free again
      // 3D aim (Yoru): keep the exact hit point and surface; a 2D drag goes back to "Bounces off".
      const r3 = (n) => Math.round(n * 1000) / 1000;
      if (at.normal && it.flash.agent === "yoru") { it.flash.target = { x: r3(at.x), z: r3(at.z) }; it.flash.hit = { x: r3(at.x), y: r3(at.y), z: r3(at.z) }; it.flash.normal = { x: r3(at.normal.x), y: r3(at.normal.y), z: r3(at.normal.z) }; }
      else { delete it.flash.hit; delete it.flash.normal; }
    } else if (drag.type === "point") {
      const it = d.items.find((i) => i.id === drag.item.id);
      const p = it.route[drag.index];
      p.x = snap(at.x); p.z = snap(at.z);
      p.y = floorAt(p.x, p.z, at.y ?? p.y) ?? p.y;
      if (drag.index === 0) { it.x = p.x; it.y = p.y; it.z = p.z; }
    } else if (drag.type === "zoneTurn") {
      // Turns the zone so its width points at the mouse (every zone of this bot turns together).
      const it = d.items.find((i) => i.id === drag.item.id);
      it.zone = { ...it.zone, turn: zoneTurnToward(it, d.start, drag.center, at) };
    } else if (drag.type === "spotPoint") {
      const it = d.items.find((i) => i.id === drag.item.id);
      const s = it.spots && it.spots[drag.spot];
      if (s) {
        const p = drag.index >= 0 && s.route ? s.route[drag.index] : s;
        p.x = snap(at.x); p.z = snap(at.z);
        p.y = floorAt(p.x, p.z, at.y ?? p.y) ?? p.y;
        if (drag.index === 0 && s.route) { s.x = p.x; s.y = p.y; s.z = p.z; }
      }
    } else if (drag.type === "width") {
      const it = d.items.find((i) => i.id === drag.item.id);
      const a = across(it);
      const w = Math.abs((at.x - it.x) * a.x + (at.z - it.z) * a.z) * 2;
      it.width = Math.round(Math.max(it.kind === "targets" ? 0 : 0.4, Math.min(it.kind === "targets" ? 30 : 12, w)) * 10) / 10;
    } else if (drag.type === "startSpot") {
      const s = d.start.spots && d.start.spots[drag.index];
      if (s) { s.x = snap(at.x); s.z = snap(at.z); s.y = floorAt(s.x, s.z, at.y ?? s.y) ?? s.y; }
    } else if (drag.type === "startSpotTurn") {
      const s = d.start.spots && d.start.spots[drag.index];
      if (s) s.facing = Math.round(yawDeg(s, at));
    } else if (drag.type === "spotMove") {
      // The whole spot (and its route) follows the mouse, each point keeping its own floor height.
      const it = d.items.find((i) => i.id === drag.item.id);
      const s = it.spots && it.spots[drag.spot], o = drag.orig;
      if (s && o) {
        const ox = at.x - drag.ax, oz = at.z - drag.az, oy = at.stand ? at.y - (o.y ?? 0) : 0;
        const put = (p, q) => { p.x = snap(q.x + ox); p.z = snap(q.z + oz); p.y = floorAt(p.x, p.z, (q.y ?? 0) + oy) ?? q.y; };
        if (s.route && o.route) { s.route.forEach((p, i) => put(p, o.route[i])); Object.assign(s, { x: s.route[0].x, y: s.route[0].y, z: s.route[0].z }); }
        else if (isDot(it)) { Object.assign(s, structuredClone(o)); placeDotSpot(it, s, at.dotHit ? at : { x: snap(o.x + ox), z: snap(o.z + oz) }, e.altKey, true); }
        else put(s, o);
      }
    } else if (drag.type === "spotPeekWidth") {
      // One extra spot's own A-D strafe width (the others keep theirs).
      const it = d.items.find((i) => i.id === drag.item.id);
      const q = it.spots && it.spots[drag.spot], sp = q && q.route && q.route[1];
      if (sp) {
        const a = across(it, sp);
        const w = Math.abs((at.x - sp.x) * a.x + (at.z - sp.z) * a.z) * 2;
        q.peekWidth = Math.round(Math.max(0.4, Math.min(8, w)) * 10) / 10;
      }
    } else if (drag.type === "peekWidth") {
      // A peeker's A-D strafe at its peek spot (point 2): the same width either side of it.
      const it = d.items.find((i) => i.id === drag.item.id);
      const sp = it.route[1], a = across(it, sp);
      const w = Math.abs((at.x - sp.x) * a.x + (at.z - sp.z) * a.z) * 2;
      it.peekWidth = Math.round(Math.max(0.4, Math.min(8, w)) * 10) / 10;
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
  const wasOn = S.tool && toolKey(S.tool) === toolKey(tool);
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

// Which tray button a tool belongs to (a saved bot has its own button).
const toolKey = (tool) => (tool.saved ? `saved:${tool.saved.id}` : tool.move || tool.kind);

function setTool(tool) {
  S.tool = tool;
  S.addPoint = false; S.addSpot = false;
  for (const b of document.querySelectorAll(".tool")) b.classList.toggle("on", !!tool && b.dataset.tool === toolKey(tool));
  draw();
}

function place(tool, at) {
  const snapped = at.stand ? { x: at.x, z: at.z } : { x: Math.round(at.x * 10) / 10, z: Math.round(at.z * 10) / 10 };
  const y = at.stand ? at.y : floorAt(snapped.x, snapped.z, at.y ?? S.drill.start.y);
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
    // A saved bot: its settings on the spot you clicked (botSettings() holds no position or route).
    if (tool.saved) Object.assign(item, JSON.parse(JSON.stringify(tool.saved.settings)));
  } else if (tool.kind === "dot") { item = newDot(p); setDotSpot(item, at, S.drill); }
  else if (tool.kind === "targets") item = newTargets(p);
  else if (tool.kind === "wall" || tool.kind === "barrier") {
    item = tool.kind === "barrier" ? newBarrier(p) : newWall(p);
    // Walls start square to your view.
    const f = yawDeg(p, S.drill.start);
    item.turn = Math.round(f) % 180;
  } else if (tool.kind === "block" || tool.kind === "airfloor") {
    item = tool.kind === "airfloor" ? newAirFloor(p) : newBlock(tool.move, p); // studio-air-floor
    // Front (the high end of ramps and stairs, the face of walls) points at your start.
    item.turn = Math.round((yawDeg(p, S.drill.start) + 180) % 360);
  } else if (tool.kind === "smoke") item = newSmoke(p);
  createPieceSnap(S.drill.items, item)?.move(item, false, true);
  edit((d) => { d.items.push(item); joinWave(d, [item]); });
  S.sel = item.id;
  renderSide();
}

function addPoint(it, at) {
  const x = at.stand ? at.x : Math.round(at.x * 10) / 10, z = at.stand ? at.z : Math.round(at.z * 10) / 10;
  const last = it.route[it.route.length - 1];
  const y = at.stand ? at.y : floorAt(x, z, at.y ?? last.y);
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
// 3D view: WASD moves the point you look at (W forward, S back, A left, D right, as the camera
// faces), Space up, Ctrl down, Shift for 3x speed. Held keys move smoothly every frame.
const held = new Set();
let walkFrame = 0, walkLast = 0;
const WALK = { w: [1, 0], s: [-1, 0], a: [0, -1], d: [0, 1] };
const LIFT = { " ": 1, control: -1 };
function walk(now) {
  walkFrame = 0;
  if (!held.size || !S.mode3d || !view3d || S.screen !== "editor") { held.clear(); return; }
  const dt = Math.min(0.05, (now - walkLast) / 1000);
  walkLast = now;
  let f = 0, r = 0, u = 0;
  for (const k of held) { if (WALK[k]) { f += WALK[k][0]; r += WALK[k][1]; } if (LIFT[k]) u += LIFT[k]; }
  const len = Math.hypot(f, r), fast = held.has("shift") ? 3 : 1;
  if (len) {
    const speed = 9 * fast * dt / len;
    view3d.moveBy(f * speed, r * speed);
  }
  if (u) view3d.moveUp(u * 7.8 * fast * dt);
  if (len || u) draw();
  walkFrame = requestAnimationFrame(walk);
}
addEventListener("keyup", (e) => {
  held.delete(e.key.toLowerCase());
  // Space moves the 3D camera up; don't let it also press a focused button.
  if (e.key === " " && S.mode3d && S.screen === "editor" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) e.preventDefault();
});
addEventListener("blur", () => held.clear());
addEventListener("keydown", (e) => {
  if (S.screen !== "editor" || document.querySelector(".scrim, .coach")) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) && document.activeElement.type !== "range";
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (!typing && !e.altKey && S.mode3d && view3d && (k === "control" || (k === " " && !mod))) {
    e.preventDefault();
    held.add(k);
    if (!walkFrame) { walkLast = performance.now(); walkFrame = requestAnimationFrame(walk); }
    return;
  }
  // 3D: Ctrl+W/A/S/D fly down and that way at once (so Ctrl+A doesn't select the page, and in 3D Ctrl+S /
  // Ctrl+D don't save / copy: use the buttons). Other Ctrl shortcuts (Ctrl+Z, Ctrl+Y) stop the descent.
  if (!typing && e.ctrlKey && !e.altKey && !e.metaKey && S.mode3d && view3d && WALK[k]) {
    e.preventDefault();
    held.add(k); held.add("control");
    if (!walkFrame) { walkLast = performance.now(); walkFrame = requestAnimationFrame(walk); }
    return;
  }
  if (mod) held.delete("control");
  // Ctrl+A would select all the text on the page; nothing in the editor uses it.
  if (mod && k === "a" && !typing) { e.preventDefault(); return; }
  if (!typing && !mod && !e.altKey && S.mode3d && view3d && (WALK[k] || k === "shift")) {
    if (WALK[k]) e.preventDefault();
    held.add(k);
    if (!walkFrame && [...held].some((x) => WALK[x])) { walkLast = performance.now(); walkFrame = requestAnimationFrame(walk); }
    return;
  }
  if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveCurrent(); return; }
  if (typing) return;
  if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); }
  else if (e.key === "Delete" || e.key === "Backspace") {
    // Your start selected: Backspace removes the extra start you placed or grabbed (never your main start).
    if (S.sel === "start") {
      const n = (S.drill.start.spots || []).length, j = S.startSel ?? (S.addStart ? n - 1 : -1);
      if (j >= 0 && j < n) { e.preventDefault(); removeStart(j); }
      return;
    }
    if (!selItem()) return;
    e.preventDefault();
    // A spot you placed or grabbed goes first; holding the key past the last spot doesn't delete the bot.
    if (removeSpotKey() || e.repeat || performance.now() - spotRemovedAt < 600) return;
    removeSelected();
  }
  else if (e.key === "Escape") {
    if (S.group.length > 1) { setGroup([]); renderSide(); draw(); }
    else if (S.tool) setTool(null);
    else if (S.addSpot) { S.addSpot = false; renderSide(); draw(); }
    else if (S.addStart) { S.addStart = false; renderSide(); draw(); }
    else if (S.addPoint) { S.addPoint = false; S.addSpot = false; renderSide(); draw(); }
    else if (S.sel) { S.sel = null; renderSide(); draw(); }
  }
});

function duplicate() {
  if (S.group.length > 1) {
    // Copies the whole group 1.5 m to the side; bots that trade a bot in the group trade its copy.
    const items = groupItems(), ids = new Map(items.map((i, n) => [i.id, `${i.kind}-${(Date.now() + n).toString(36)}${n}`]));
    const a = across(selItem() || items[0]);
    const copies = items.map((i) => {
      const c = JSON.parse(JSON.stringify(i));
      c.id = ids.get(i.id);
      if (c.tradeOf && ids.has(c.tradeOf)) c.tradeOf = ids.get(c.tradeOf);
      shiftItem(c, Math.round(a.x * 15) / 10, Math.round(a.z * 15) / 10);
      return c;
    });
    edit((d) => { d.items.push(...copies); joinWave(d, copies); });
    setGroup(copies.map((c) => c.id));
    renderSide();
    return;
  }
  const it = selItem();
  if (!it) return;
  const copy = JSON.parse(JSON.stringify(it));
  copy.id = `${it.kind}-${Date.now().toString(36)}`;
  const a = it.kind === "wall" ? { x: 0, z: 1 } : across(it);
  const shift = (o) => { o.x = Math.round((o.x + a.x * 1.5) * 10) / 10; o.z = Math.round((o.z + a.z * 1.5) * 10) / 10; o.y = floorAt(o.x, o.z, o.y) ?? o.y; };
  shift(copy);
  if (copy.route) copy.route.forEach(shift);
  if (copy.flash && copy.flash.target) shift(copy.flash.target);
  edit((d) => { d.items.push(copy); joinWave(d, [copy]); });
  S.sel = copy.id;
  renderSide();
}
function removeSelected() {
  if (S.group.length > 1) {
    const gone = new Set(S.group);
    edit((d) => (d.items = d.items.filter((i) => !gone.has(i.id))));
    setGroup([]);
    renderSide();
    return;
  }
  const it = selItem();
  if (!it) return;
  edit((d) => (d.items = d.items.filter((i) => i.id !== it.id)));
  S.sel = null;
  S.addPoint = false; S.addSpot = false;
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
// studio-slider-number-v1 (17 Nov 2026): every slider also has a box to type the exact number (Enter or click away
// to apply). Typed values are kept between the slider's ends and may be finer than its step (to 0.01).
function numberBox(min, max, step, value, apply) {
  const dec = Math.min(2, Math.max(0, (String(step).split(".")[1] || "").length));
  const box = h("input", {
    type: "number", class: "slider-num", min, max, step: "any", value: (+value).toFixed(dec), "aria-label": "Type a value",
    onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); e.stopPropagation(); },
    onchange: (e) => {
      const raw = parseFloat(e.target.value);
      if (!isFinite(raw)) { e.target.value = box.dataset.last; return; }
      const v = Math.round(Math.min(max, Math.max(min, raw)) * 100) / 100;
      e.target.value = String(v); box.dataset.last = String(v); apply(v);
    },
  });
  box.dataset.last = box.value;
  box.show = (v) => { box.value = (+v).toFixed(dec); box.dataset.last = box.value; };
  return box;
}
function slider(min, max, step, value, fmt, set) {
  const out = h("output", {}, fmt(value));
  const key = `slider-${Math.random()}`;
  const input = h("input", {
    type: "range", min, max, step, value,
    oninput: (e) => { const v = +e.target.value; out.textContent = fmt(v); box.show(v); edit((d) => set(d, v), { key, quiet: true }); },
    onchange: () => renderSide(),
  });
  const box = numberBox(min, max, step, value, (v) => { input.value = v; out.textContent = fmt(v); edit((d) => set(d, v)); renderSide(); });
  return h("div", { class: "slider" }, input, box, out);
}
// A slider over a list of allowed values (studio-30min, 13 Nov 2026): fine steps at the start, coarser
// later, so 0-30 min stays easy to set to the second where it matters.
function stopSlider(stops, value, fmt, set) {
  const index = (v) => { let best = 0; for (let i = 1; i < stops.length; i++) if (Math.abs(stops[i] - v) < Math.abs(stops[best] - v)) best = i; return best; };
  const out = h("output", {}, fmt(value));
  const key = `slider-${Math.random()}`;
  const input = h("input", {
    type: "range", min: 0, max: stops.length - 1, step: 1, value: index(value),
    oninput: (e) => { const v = stops[+e.target.value]; out.textContent = fmt(v); box.show(v); edit((d) => set(d, v), { key, quiet: true }); },
    onchange: () => renderSide(),
  });
  // Typed values can be anything between the first and last stop (the slider shows the nearest stop).
  const box = numberBox(stops[0], stops[stops.length - 1], 0.1, value, (v) => { input.value = index(v); out.textContent = fmt(v); edit((d) => set(d, v)); renderSide(); });
  return h("div", { class: "slider" }, input, box, out);
}
const range = (from, to, step) => { const out = []; for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 10) / 10); return out; };
// Round length 10 s - 30 min; smoke times 0 - 30 min (0.5 s steps for the first minute).
const ROUND_STOPS = [...range(10, 60, 5), ...range(75, 300, 15), ...range(330, 1800, 30)];
const SMOKE_STOPS = [...range(0, 60, 0.5), ...range(61, 300, 1), ...range(310, 1800, 10)];
const clock = (v) => (v >= 60 ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}` : `${v.toFixed(v % 1 ? 1 : 0)} s`);
function toggle(on, title, sub, set) {
  return h("button", { class: "switch" + (on ? " on" : ""), role: "switch", "aria-checked": String(on), onclick: () => edit((d) => set(d, !on)) },
    h("span", {}, title, sub ? h("small", {}, sub) : null), h("i"));
}
const secs = (v) => (v === 0 ? "0 s" : `${v.toFixed(v < 10 ? 1 : 0)} s`);
const metres = (v) => `${v.toFixed(1)} m`;
// When a bot first shows up: with the round (after a few seconds), when you walk across its line,
// or after you kill another bot (a trade).
function showsUpField(b, d) {
  // studio-waves-v1 / waves-groups-v1 / waves-tabs-v1: a bot in a wave comes with its group (Drill settings > Bots
  // show up). Its delay after the group starts is set here (the wave list only lists bots). Selecting a bot of
  // another wave switches the wave tab to it.
  if (d.round.order === "waves" && d.round.goal !== "track" && inWaves(d).has(b.id)) {
    const names = wavePlans(d).filter((p) => p.bots.some((x) => x.bot === b.id)).map((p) => p.name);
    const where = wavesOfBot(d, b.id), c = waveCursor();
    if (c && where.length && !where.some((x) => x.wave === c.wave)) { S.waveSel = where[0]; setTimeout(draw, 0); }
    const at = waveList(d).flatMap((w) => (w.groups || []).flatMap((g) => g.bots || [])).find((x) => x.bot === b.id)?.at || 0;
    // waves-trades-v1: or it trades a bot of its group: comes tradeMin-tradeMax s after you kill that bot.
    const mates = new Set(waveList(d).flatMap((w) => (w.groups || []).filter((g) => (g.bots || []).some((x) => x.bot === b.id)).flatMap((g) => g.bots.map((x) => x.bot))));
    const groupMates = d.items.filter((i) => i.kind === "bot" && i.id !== b.id && mates.has(i.id));
    const target = tradeTarget(d, b);
    const lo = b.tradeMin ?? 0.3, hi = b.tradeMax ?? 1;
    const tradeTo = (it, dd, id) => { it.tradeOf = id; if (id && stuckTradeRings(dd).some((ring) => ring.some((x) => x.id === it.id))) it.tradeStart = true; };
    const pickWave = seg([["group", "When its group starts"], ["kill", "When I kill a bot"]], b.tradeOf ? "kill" : "group",
      (v) => edit(mod((it, dd) => {
        if (v === "group") { it.tradeOf = null; return; }
        const near = groupMates.slice().sort((p, q) => dist(p, it) - dist(q, it))[0];
        it.tradeStart = false; it.tradeOf = near ? near.id : null;
        if (near && stuckTradeRings(dd).some((ring) => ring.some((x) => x.id === it.id))) it.tradeStart = true;
        if (!near) toast("Put another bot in the same group first: this one comes when you kill that one.");
      })));
    const open = h("button", { class: "btn small", onclick: () => { S.sel = null; renderSide(); draw(); } }, "Open waves");
    if (b.tradeOf) return field("Shows up", h("div", {}, pickWave,
      h("p", { class: "help" }, "When I kill (a bot in the same group):"),
      groupMates.length ? h("div", { class: "btn-row" }, groupMates.map((o) => h("button", {
        class: "btn small" + (o.id === b.tradeOf ? " primary" : ""), onclick: () => edit(mod((it, dd) => tradeTo(it, dd, o.id))),
      }, itemName(d, o)))) : h("p", { class: "help" }, "No other bot in its group yet."),
      h("p", { class: "help" }, "It swings in this long after the kill (random between the two):"),
      slider(0, 3, 0.05, lo, (v) => `from ${secs(v)}`, (dd, v) => mod((it) => { it.tradeMin = v; if ((it.tradeMax ?? 1) < v) it.tradeMax = v; })(dd)),
      slider(0, 3, 0.05, hi, (v) => `to ${secs(v)}`, (dd, v) => mod((it) => { it.tradeMax = v; if ((it.tradeMin ?? 0.3) > v) it.tradeMin = v; })(dd)),
      // waves-trade-start-v1: shows up first with its group, then only as a trade. (wave-plays-v1: the per-bot
      // "comes back as a trade" count is gone; a wave can be played several times instead, in its wave card.)
      toggle(!!b.tradeStart, "Also there when its group starts", "Shows up with its group first, then only as a trade", (dd, v) => mod((it) => (it.tradeStart = v))(dd)),
      open),
      !target ? "The bot it traded is gone. Pick another bot above."
      : `In ${names.join(", ")}: ${b.tradeStart ? "it shows up when the group starts; after that, every" : "every"} time you kill ${itemName(d, target)} there, this bot swings ${secs(lo)}–${secs(hi)} later. The group isn't done until it came and you killed it.${mates.has(target.id) ? "" : ` ${itemName(d, target)} isn't in its group, so it comes with the group instead.`}`);
    return field("Shows up", h("div", {}, pickWave,
      h("p", { class: "help" }, `In ${names.join(", ")}. It comes when that group starts, and doesn't come back by itself.`),
      field("Comes after", slider(0, 10, 0.1, at, (v) => (v ? `${secs(v)} after its group starts` : "right when its group starts"),
        (dd, v) => { for (const w of wavesOf(dd).waves) for (const g of w.groups) for (const x of g.bots) if (x.bot === b.id) x.at = v; }),
        "E.g. the flash at 0 s, the bot that swings with it 0.5 s later."),
      open));
  }
  const timed = d.round.order === "together" || d.round.order === "waves" || b.move === "patrol";
  // studio-trade-pair: a bot that already trades this one can be picked too (two bots taking turns: kill 1, 2 comes;
  // kill 2, 1 comes). The game runs such loops like longer rings; the loop starts from the bot "Also there at the start".
  const others = d.items.filter((i) => i.kind === "bot" && i.id !== b.id);
  // A pick that closes a loop where nobody is there at the start turns "Also there at the start" on for this bot.
  const tradeTo = (it, dd, id) => { it.tradeOf = id; if (id && stuckTradeRings(dd).some((ring) => ring.some((x) => x.id === it.id))) it.tradeStart = true; };
  const mode = b.tradeOf ? "kill" : b.trigger ? "line" : "round";
  const pick = seg([["round", "With the round"], ["line", "When I cross a line"], ["kill", "When I kill a bot"]], mode,
    (v) => edit(mod((it, dd) => {
      it.trigger = v === "line" ? newTrigger(it, dd.start) : null;
      if (v === "kill") {
        // Trades the nearest other bot first (usually the one it's covering), preferring one that doesn't
        // already trade this bot; pick another below.
        const near = others.slice().sort((p, q) => (p.tradeOf === it.id) - (q.tradeOf === it.id) || dist(p, it) - dist(q, it))[0];
        tradeTo(it, dd, near ? near.id : null);
        if (!near) toast("Add another bot first: this one shows up when you kill that one.");
      } else it.tradeOf = null;
    })));
  const delay = (label, max) => slider(0, max, 0.1, b.delay || 0, label, (dd, v) => mod((it) => (it.delay = v))(dd));
  if (b.tradeOf) {
    const target = tradeTarget(d, b);
    const lo = b.tradeMin ?? 0.3, hi = b.tradeMax ?? 1;
    return field("Shows up", h("div", {}, pick,
      h("p", { class: "help" }, "When I kill:"),
      h("div", { class: "btn-row" }, others.map((o) => h("button", {
        class: "btn small" + (o.id === b.tradeOf ? " primary" : ""), onclick: () => edit(mod((it, dd) => tradeTo(it, dd, o.id))),
      }, itemName(d, o)))),
      h("p", { class: "help" }, "It swings in this long after the kill (random between the two):"),
      slider(0, 3, 0.05, lo, (v) => `from ${secs(v)}`, (dd, v) => mod((it) => { it.tradeMin = v; if ((it.tradeMax ?? 1) < v) it.tradeMax = v; })(dd)),
      slider(0, 3, 0.05, hi, (v) => `to ${secs(v)}`, (dd, v) => mod((it) => { it.tradeMax = v; if ((it.tradeMin ?? 0.3) > v) it.tradeMin = v; })(dd)),
      toggle(!!b.tradeStart, "Also there at the start", "Shows up once when the round begins, then only as a trade", (dd, v) => mod((it) => (it.tradeStart = v))(dd)),
      ...(b.tradeStart ? [
        h("p", { class: "help" }, "At the start it shows up this far into the round (random between the two, new each round):"),
        slider(0, 15, 0.1, b.tradeStartMin ?? 0, (v) => `from ${secs(v)}`, (dd, v) => mod((it) => { it.tradeStartMin = v; if ((it.tradeStartMax ?? 0) < v) it.tradeStartMax = v; })(dd)),
        slider(0, 15, 0.1, b.tradeStartMax ?? 0, (v) => `to ${secs(v)}`, (dd, v) => mod((it) => { it.tradeStartMax = v; if ((it.tradeStartMin ?? 0) > v) it.tradeStartMin = v; })(dd)),
      ] : [])),
      !target ? "The bot it traded is gone. Pick another bot above."
      : b.tradeStart
        ? `A trade that starts the round: it shows up once, ${(b.tradeStartMax ?? 0) > 0 ? `${secs(b.tradeStartMin ?? 0)}–${secs(b.tradeStartMax)} into the round` : "as soon as the round begins"}, and does its move once (a peeker swings once). After that, every time you kill ${itemName(d, target)}, it shows up ${secs(lo)}–${secs(hi)} later. Use this on one bot when your trades go round in a ring, so the ring can begin.`
        : `A trade: it isn't there at the start. Every time you kill ${itemName(d, target)}, this bot shows up ${secs(lo)}–${secs(hi)} later and does its move once (a peeker swings once). Real trades are 0.3–1 s. It doesn't take turns; with random spots each trade swings from one of them, and a holder or strafer can use a random zone.`);
  }
  if (b.trigger) {
    const turns = d.round.order !== "together" && d.round.order !== "waves" && d.round.goal !== "track";
    return field("Shows up", h("div", {}, pick, delay((v) => (v ? `${secs(v)} after you cross` : "as soon as you cross"), 5)),
      `Drag the yellow line's ends on the map. Walk across it and this bot appears where it starts, then does its move (peek, run, flash).${turns ? " It doesn't take turns with the other bots." : ""}${d.round.move ? "" : " Turn on \"I can walk around\" in drill settings."}`);
  }
  return field("Shows up", h("div", {}, pick, timed ? delay((v) => (v ? `after ${secs(v)}` : "right away"), 15) : null),
    timed ? null : "Takes its turn with the other bots.");
}
const mod = (fn) => (d) => { const it = d.items.find((i) => i.id === S.sel); if (it) fn(it, d); };

function renderSide() {
  if (!side || !S.drill) return;
  const scroll = side.scrollTop;
  side.textContent = "";
  // The group ends when something else got selected (placing, Show, undo) or its things are gone.
  if (S.group.length) {
    S.group = S.group.filter((id) => S.drill.items.some((i) => i.id === id));
    if (S.group.length < 2 || !S.group.includes(S.sel)) S.group = [];
  }
  const it = selItem();
  const parts = S.group.length > 1 ? groupPanel()
    : S.sel === "start" ? startPanel()
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
  const list = problems(S.drill, floorCheck(), wallLevels());
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
    }, rankIcon(b.shoots), itemName(d, b)))),
    h("p", { class: "help" }, d.round.die
      ? "Their hits hurt, and if you die the round ends."
      : "Their hits take health and slow you down (like getting tagged in the game), but you can't die. Turn on \"Bots can kill me\" below for real fights."),
    h("button", { class: "btn small", onclick: () => edit((dd) => dd.items.forEach((i) => { if (i.kind === "bot") i.shoots = "off"; })) }, "Make every bot stop shooting"));
}

function drillPanel() {
  const d = S.drill, r = d.round;
  const set = (fn) => (v) => edit((dd) => fn(dd.round, v));
  const bots = d.items.filter((i) => i.kind === "bot").length;
  const oneByOne = r.order !== "together" && r.order !== "waves";
  return [
    ...head("gear", "", "Drill settings", "Click anything on the map to change it. These settings are for the whole drill."),
    checksBox(),
    h("div", { class: "group" },
      h("label", {}, "Place"),
      onMap()
        ? h("p", { class: "help" }, `${mapLabel(d.place)}. To use another map, make a new drill.`)
        : h("div", {},
          field("Arena preset", seg([["small", "Small · 24 m"], ["medium", "Medium · 40 m"], ["large", "Large · 70 m"]], d.arenaSize || d.arena ? null : d.rangeSize, (v) => { edit(dd => { dd.rangeSize = v; delete dd.arenaSize; delete dd.arena; }); fitView(); draw(); })),
          field("Arena size", slider(12, 400, 1, arenaSize(d), v => `${v} × ${v} m`, (dd,v) => {dd.arenaSize=v;delete dd.arena;fitView();}), "Square arena, centered. Enlarge it without moving your targets."),
          ...arenaSideFields(d),
          field("Boundary wall height", slider(0, 40, .5, arenaWallHeight(d), v => v ? metres(v) : "No walls", (dd,v) => {dd.arenaWallHeight=v;}), "Adds four solid walls around the empty area."),
        ),
      field("Mode", seg([["charcoal", "Dark"], ["light", "Light"]], darkArena(d) ? "charcoal" : "light", v => edit(dd => { dd.arenaTheme = v; }))),
      onMap() ? null : arenaColorsField(d),
      field("Surface", seg(SURFACES, arenaSurface(d), v => edit(dd => setArenaSurface(dd, v)))),
      arenaSurface(d) === 'tile' ? field("Grid size", slider(.25,8,.05,d.floorTileScale ?? 2.4,metres,(dd,v)=>{dd.floorTileScale=dd.wallTileScale=v;for(const it of dd.items)delete it.surfaceScale;})) : null),
    shootersBox(),
    h("div", { class: "group" },
      field("Goal", seg([["score", "Score kills", "Kill as many as you can before time runs out"], ["clear", "Clear them all", "Kill every bot as fast as you can"], ["track", "Tracking", "Keep your crosshair on the target"]], r.goal, set((o, v) => (o.goal = v))),
        { score: "Kill as many as you can before the time runs out.", clear: "Every bot appears once. Kill them all as fast as you can; your time is scored.", track: "Hold fire on the target. Score is how long you stay on it. Targets can't die." }[r.goal]),
      field(r.goal === "clear" ? "Time limit" : "Round length", h("div", {},
        seg([[30, "30 s"], [60, "1 min"], [120, "2 min"], [300, "5 min"], [1800, "30 min"]], r.time, set((o, v) => (o.time = v))),
        stopSlider(ROUND_STOPS, r.time, clock, (dd, v) => (dd.round.time = v)))),
      r.goal === "clear" ? field("Good time (3 stars)", slider(0, 120, 1, r.par || 0, (v) => (v ? `${v} s` : "Auto"), (dd, v) => (dd.round.par = v)), "Beat this time for the best rating. Auto: about 2.5 s per bot.") : null),
    h("div", { class: "group" },
      h("label", {}, "Your weapon"), weaponGrid(r.weapon, false, set((o, v) => (o.weapon = v))),
      r.goal === "track" ? null : field("Firing", seg([[true, "Full auto (hold to spray)"], [false, "One shot per click"]], r.auto !== false, set((o, v) => (o.auto = v))),
        "Full auto works like in the game: hold the button and rifles keep firing.")),
    h("div", { class: "group" },
      h("label", {}, "You"),
      field(null, toggle(r.move, "I can walk around", "Off: you stay on your start spot and only aim.", (dd, v) => (dd.round.move = v))),
      field(null, toggle(r.die, "Bots can kill me", "If you die, the round ends.", (dd, v) => (dd.round.die = v))),
      // studio-heal-on-kill: the game's own healOnKill rule (health and armor back to full on every kill).
      field(null, toggle(r.heal, "Refill HP when I kill a bot", (r.healHp ?? 100) >= 100 ? "Every kill puts your health and armor back to full." : `Every kill gives you +${r.healHp} HP (up to 100). Armor is not refilled.`, (dd, v) => (dd.round.heal = v))),
      // studio-heal-amount-v1: how much HP each kill gives back (100 = full health and armor, as before).
      r.heal ? field("HP per kill", slider(10, 100, 5, r.healHp ?? 100, (v) => (v >= 100 ? "Full" : `+${v} HP`), (dd, v) => (dd.round.healHp = v))) : null,
      field(null, toggle(r.ammo, "Real magazine and reloads", "Off: endless ammo.", (dd, v) => (dd.round.ammo = v)))),
    // studio-move-dodge-v1 (17 Nov 2026): Realistic = the game's move-dodge / aim-lag / bot-lead rules (CnrSARj_.js
    // __aimMoveDodge); Basic = bots hit a moving player as well as a still one (rules.moveDodge = false).
    d.items.some((i) => i.kind === "bot" && i.shoots && i.shoots !== "off") ? h("div", { class: "group" },
      h("label", {}, "Bot aim when you move"),
      field(null, seg([["realistic", "Realistic", "Bots track you like players: moving, A-D and Dash make them miss more"], ["basic", "Basic", "Bots hit you just as well whether you move or not"]], r.dodge === "basic" ? "basic" : "realistic", set((o, v) => (o.dodge = v))),
        r.dodge === "basic"
          ? "Bots hit you just as well whether you stand still or move. Only their rank's aim decides."
          : "Each bot aims a moment behind you (Radiant 0.10 s, Diamond 0.14 s, Gold 0.19 s) and leads your movement, like a player. Steady running is still hit most of the time; sudden direction changes make it miss, and headshots get rarer the faster you move. Standing still or running straight at a bot: no change."),
      // studio-adad-controls-v1: one switch for the A-D reward and Jett's Dash protection, with every number editable
      // (game: CnrSARj_.js __aimMoveDodge reads rules.adadMiss / adadWindow / adadGap / adadHeads / dashMaxHits / dashLand).
      r.dodge !== "basic" ? field(null, toggle(r.dodgeAdad !== false, "Reward A-D and Dash", "Switching between A and D, and Jett's Dash, throw the bots' aim off for a moment.", (dd, v) => (dd.round.dodgeAdad = v))) : null,
      r.dodge !== "basic" && r.dodgeAdad !== false ? h("div", { class: "dodge-sub" },
        field("Miss chance after a switch", slider(0, 100, 5, r.adadMiss ?? 50, (v) => `${v} %`, (dd, v) => (dd.round.adadMiss = v)),
          "Share of bot hits that miss right after you switch between A and D. 0 % = no reward, 100 % = they never hit you then."),
        field("Bots thrown off for", slider(0, 0.5, 0.01, r.adadWin ?? 0, (v) => (v ? `${v.toFixed(2)} s` : "Auto"), (dd, v) => (dd.round.adadWin = v)),
          "How long after a switch the bots' aim is off. Auto = each bot's own reaction delay (Radiant 0.10 s, Diamond 0.14 s, Gold 0.19 s)."),
        field("Switch counts within", slider(0.05, 0.4, 0.01, r.adadGap ?? 0.15, (v) => `${v.toFixed(2)} s`, (dd, v) => (dd.round.adadGap = v)),
          "Letting go of A and pressing D (or the other way) counts as a switch if the second key comes within this time."),
        field(null, toggle(!!r.adadHeads, "Headshots right after a switch", "Off: in that moment, bot hits that would be headshots land on the body.", (dd, v) => (dd.round.adadHeads = v))),
        field("Max hits per Dash", slider(0, 4, 1, r.dashHits ?? 1, (v) => (v === 0 ? "None" : v === 1 ? "1 body hit" : `${v} body hits`), (dd, v) => (dd.round.dashHits = v)),
          "From all bots together during one Jett Dash (0.45 s). Hits in a Dash always land on the body."),
        field("Chance a Dash gets hit", slider(0, 100, 5, r.dashLand ?? 50, (v) => `${v} %`, (dd, v) => (dd.round.dashLand = v)),
          "Share of Dashes where bots can hit you at all (up to the max above). Mostly matters when you Dash toward or away from a bot; sideways Dashes already make bots miss.")) : null) : null,
    r.goal !== "track" && bots ? h("div", { class: "group" },
      field("Bots show up", seg([["together", "All at once"], ["random", "One by one, random"], ["inOrder", "One by one, in order"], ["waves", "In waves", "Wave A, B, C... each in groups: kill one group and the next comes"]], r.order,
        (v) => edit((dd) => { dd.round.order = v; if (v === "waves" && !dd.round.waves) dd.round.waves = newWaves(dd); })),
        oneByOne ? "On its turn each bot does its thing once (a peeker peeks once). Rushers without a flash walk all round."
        : r.order === "waves" ? "Waves come in order. In a wave, group 1 comes first; kill all of it and group 2 comes, and so on. Kill the last group and the next wave starts." : null),
      r.order === "waves" ? wavesBox(d) : null,
      oneByOne ? field("How many at a time", slider(1, 5, 1, r.atOnce || 1, (v) => `${v}`, (dd, v) => (dd.round.atOnce = v))) : null,
      oneByOne ? field("Pause before the next one", slider(0, 5, 0.1, r.gap ?? 1, (v) => (v === 0 ? "right away" : secs(v)), (dd, v) => (dd.round.gap = v))) : null) : null,
    h("div", { class: "group" },
      field("Description", h("textarea", { class: "text", maxlength: 300, placeholder: "Shown on the card in the lobby.", oninput: (e) => edit((dd) => (dd.note = e.target.value), { key: "note", quiet: true }) }, d.note || ""))),
  ];
}

// ---------- waves (studio-waves-v1, reworked as waves-groups-v1) ----------
// waves-tabs-v1 (17 Nov 2026, user): you edit one wave at a time. S.waveSel = { wave, group } is the wave tab and the
// group new bots go into; bots of the other waves are drawn faded on the map (2D and 3D) so they don't get in the way.
const wavesOn = () => !!S.drill && S.drill.round.order === "waves" && S.drill.round.goal !== "track";
function waveCursor() {
  if (!wavesOn()) return null;
  const list = waveList(S.drill);
  if (!list.length) return null;
  const w = list.find((x) => x.id === S.waveSel?.wave) || list[0], gs = w.groups || [];
  const g = gs.find((x) => x.id === S.waveSel?.group) || gs[0];
  return { wave: w.id, group: g ? g.id : null };
}
// The waves / groups a bot is in: [{ wave, group }].
function wavesOfBot(d, id) {
  const out = [];
  for (const w of waveList(d)) for (const g of w.groups || []) if ((g.bots || []).some((b) => b.bot === id)) out.push({ wave: w.id, group: g.id });
  return out;
}
function waveFaded(it) {
  if (it.kind !== "bot" || it.id === S.sel) return false;
  const c = waveCursor();
  if (!c) return false;
  const where = wavesOfBot(S.drill, it.id);
  return where.length > 0 && !where.some((x) => x.wave === c.wave);
}
const waveKey = () => { const c = waveCursor(); return c ? c.wave + "/" + c.group : ""; };
// New bots (placed, copied) go into the active group of the wave you are editing.
function joinWave(dd, items) {
  const c = waveCursor();
  if (!c || !c.group) return;
  const g = wavesOf(dd).waves.find((w) => w.id === c.wave)?.groups.find((x) => x.id === c.group);
  if (g) for (const it of items) if (it.kind === "bot" && !g.bots.some((b) => b.bot === it.id)) g.bots.push({ bot: it.id, at: 0 });
}
// waves-groups-v1 (17 Nov 2026): waves A, B, C... always in order; each wave has groups that come one after another
// (the next group once you kill every bot of the one before). Data: round.waves, see drill.js waveList / wavePlans.
// Game side: CnrSARj_.js (tools/patch-studio-waves.cjs + patch-studio-waves-v2.cjs).
const newGroup = (bots = []) => ({ id: newId("group"), bots: bots.map((b) => ({ bot: b.id, at: 0 })) });
const newWave = (bots = []) => ({ id: newId("wave"), name: "", groups: [newGroup(bots)] });
function newWaves(d) {
  return { first: 1, pause: 2, groupPause: 0.5, hp: true, ammo: true, repeat: false, waves: [newWave(d.items.filter((i) => i.kind === "bot"))] };
}
// The drill's waves in the new form, for editing (an old plan list becomes one wave per plan, one group each).
function wavesOf(dd) {
  const w = dd.round.waves;
  if (!w) return (dd.round.waves = newWaves(dd));
  if (!Array.isArray(w.waves)) {
    dd.round.waves = { first: w.first ?? 1, pause: w.pause ?? w.gap ?? 2, groupPause: w.groupPause ?? 0.5, hp: w.hp !== false, ammo: w.ammo !== false, repeat: !!w.repeat, waves: waveList(dd) };
  }
  return dd.round.waves;
}
// wave-panel-v2 (17 Nov 2026, user-approved preview previews/wave-panel/index.html): compact tabs (letter, ×plays,
// bot count), name + copy / delete icons on one line, a − N× + stepper for Plays, groups with a number badge and the
// bots as wrapping chips (PLACING tag on the active group), short "+ Add group", timing as three number rows, refills
// as switches, "After the last wave" Round ends / Start again. Nothing in the panel is wider than the side bar.
function wavesBox(d) {
  const r = d.round, w = r.waves || {};
  const list = waveList(d);
  const bots = d.items.filter((i) => i.kind === "bot");
  const exists = new Set(bots.map((b) => b.id));
  const W = (fn) => (dd, v) => fn(wavesOf(dd), v);
  const setW = (fn) => (v) => edit((dd) => W(fn)(dd, v));
  const waveAt = (dd, id) => wavesOf(dd).waves.find((x) => x.id === id);
  const groupAt = (dd, wid, gid) => waveAt(dd, wid)?.groups.find((g) => g.id === gid);
  const show = (id) => { S.sel = id; renderSide(); draw(); focusOn(id); };
  const goTo = (wave, group) => { S.waveSel = { wave, group }; renderSide(); draw(); };
  const c = waveCursor();
  const cur = list.find((x) => x.id === c?.wave);
  const botsIn = (wv) => new Set((wv.groups || []).flatMap((g) => (g.bots || []).map((b) => b.bot)).filter((id) => exists.has(id))).size;
  const xBtn = (title, onclick, cls = "") => h("button", { class: "wv-x " + cls, title, "aria-label": title, onclick }, "×");
  const chip = (wv, g, b) => h("span", { class: "wv-chip" },
    h("button", { class: "wv-chip-name", title: "Show this bot", onclick: () => show(b.bot) }, itemName(d, d.items.find((x) => x.id === b.bot))),
    xBtn("Take this bot out of the group", () => edit((dd) => { const gg = groupAt(dd, wv.id, g.id); if (gg) gg.bots = gg.bots.filter((y) => y.bot !== b.bot); })));
  // "+ Bot": a small select over the bots that are placed but not in this group
  const addBot = (wv, g, free) => free.length ? h("label", { class: "wv-addbot", title: "Add a bot that's already on the map" }, "+ Bot",
    h("select", { onchange: (e) => { const id = e.target.value; if (id) edit((dd) => groupAt(dd, wv.id, g.id)?.bots.push({ bot: id, at: 0 })); } },
      h("option", { value: "" }, "Add a placed bot…"), ...free.map((b) => h("option", { value: b.id }, itemName(d, b))))) : null;
  const groupCard = (wv, g, gi) => {
    const inGroup = (g.bots || []).filter((b) => exists.has(b.bot));
    const free = bots.filter((b) => !inGroup.some((x) => x.bot === b.id));
    const on = c && c.group === g.id;
    return h("div", { class: "wv-group" + (on ? " on" : ""), title: on ? null : "Click to place bots in this group", onclick: (e) => { if (!on && !e.target.closest("button, select, input, label")) goTo(wv.id, g.id); } },
      h("div", { class: "wv-ghead" },
        h("span", { class: "wv-num" }, String(gi + 1)),
        h("span", { class: "wv-when" }, gi === 0 ? "When the wave starts" : `After group ${gi} is dead`),
        on ? h("span", { class: "wv-tag" }, "Placing") : null,
        wv.groups.length > 1 ? xBtn("Delete this group", () => edit((dd) => { const ww = waveAt(dd, wv.id); if (ww) ww.groups = ww.groups.filter((x) => x.id !== g.id); })) : null),
      inGroup.length
        ? h("div", { class: "wv-chips" }, ...inGroup.map((b) => chip(wv, g, b)), addBot(wv, g, free))
        : h("p", { class: "wv-empty" }, on ? "Place bots on the map" : "Click here, then place bots on the map", free.length ? ", or " : ".", addBot(wv, g, free)));
  };
  const tabs = h("div", { class: "wv-tabs", role: "tablist" },
    ...list.map((wv, i) => h("button", { class: "wv-tab" + (wv.id === c?.wave ? " on" : ""), role: "tab", "aria-selected": String(wv.id === c?.wave), title: waveName(wv, i),
      onclick: () => goTo(wv.id, wv.groups?.[0]?.id) },
      h("b", {}, String.fromCharCode(65 + (i % 26))), h("em", {}, wavePlays(wv) > 1 ? `×${wavePlays(wv)}` : ""),
      h("small", {}, `${botsIn(wv)} bot${botsIn(wv) === 1 ? "" : "s"}`))),
    h("button", { class: "wv-tab add", title: "Add a wave and start editing it", "aria-label": "Add a wave", onclick: () => {
      const nw = newWave(); S.waveSel = { wave: nw.id, group: nw.groups[0].id };
      edit((dd) => { wavesOf(dd).waves.push(nw); });
    } }, ic("plus")));
  const i = cur ? list.indexOf(cur) : -1;
  const plays = cur ? wavePlays(cur) : 1;
  const setPlays = (v) => edit((dd) => { const ww = waveAt(dd, cur.id); if (ww) ww.plays = Math.max(1, Math.min(5, v)); });
  const card = cur ? h("div", { class: "wv-card" },
    h("div", { class: "wv-row" },
      h("input", {
        class: "text wv-name", value: cur.name || "", placeholder: waveName(cur, i), maxlength: 40, "aria-label": "Wave name",
        onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); e.stopPropagation(); },
        oninput: (e) => edit((dd) => { const ww = waveAt(dd, cur.id); if (ww) ww.name = e.target.value; }, { key: `wave-name-${cur.id}`, quiet: true }),
      }),
      h("button", { class: "btn small icon wv-icon", title: "Copy this wave (same bots)", "aria-label": "Copy this wave", onclick: () => {
        const nid = newId("wave");
        edit((dd) => {
          const all = wavesOf(dd).waves, ww = all.find((x) => x.id === cur.id); if (!ww) return;
          const cp = structuredClone(ww); cp.id = nid; cp.name = ww.name ? `${ww.name} copy` : ""; for (const g of cp.groups) g.id = newId("group");
          all.splice(all.indexOf(ww) + 1, 0, cp);
          S.waveSel = { wave: nid, group: cp.groups[0]?.id };
        });
      } }, ic("copy")),
      h("button", { class: "btn small icon danger wv-icon", title: "Delete this wave (its bots stay on the map)", "aria-label": "Delete this wave", onclick: () => edit((dd) => { const o = wavesOf(dd); o.waves = o.waves.filter((x) => x.id !== cur.id); S.waveSel = null; }) }, ic("trash"))),
    // wave-plays-v1: play this whole wave (all groups and trades) several times before the next wave.
    h("div", { class: "wv-row wv-plays", title: "Kill every bot of this wave (all its groups) and it starts over, this many times, before the next wave. Each time is like a new wave: the pause between waves first, then refills." },
      h("span", {}, "Plays"),
      h("div", { class: "wv-stepper" },
        h("button", { "aria-label": "Fewer times", disabled: plays <= 1, onclick: () => setPlays(plays - 1) }, ic("minus")),
        h("output", {}, `${plays}×`),
        h("button", { "aria-label": "More times", disabled: plays >= 5, onclick: () => setPlays(plays + 1) }, ic("plus")))),
    ...(cur.groups || []).map((g, gi) => groupCard(cur, g, gi)),
    h("button", { class: "wv-addgroup", onclick: () => { const ng = newGroup(); S.waveSel = { wave: cur.id, group: ng.id }; edit((dd) => { waveAt(dd, cur.id)?.groups.push(ng); }); } }, "+ Add group"),
    h("p", { class: "wv-hint" }, "A new group comes after you kill the group above it.")) : null;
  const waved = inWaves(d);
  const loose = bots.filter((b) => !waved.has(b.id));
  // A timing row: label (+ a small line) and one number box in seconds.
  const tRow = (label, sub, value, set, unit = "s", min = 0, max = 30, step = 0.1) => h("div", { class: "wv-trow" },
    h("span", {}, label, sub ? h("small", {}, sub) : null),
    h("span", { class: "wv-num-in" }, numberBox(min, max, step, value, (v) => { edit((dd) => W(set)(dd, v)); renderSide(); }), h("i", {}, unit)));
  return h("div", { class: "waves wv" },
    h("label", {}, "Waves"),
    tabs,
    list.length > 1 ? h("p", { class: "wv-hint" }, "Bots of the other waves are faded on the map.") : null,
    card || h("p", { class: "wv-hint" }, "No waves yet. Add one with +."),
    loose.length ? h("p", { class: "wv-hint" }, `In no wave: ${loose.map((b) => itemName(d, b)).join(", ")}. ${loose.length > 1 ? "They are" : "It is"} there from the round start, like "All at once".`) : null,
    h("div", { class: "wv-sect" }, h("h4", {}, "Timing"),
      tRow("First wave after", null, w.first ?? 1, (o, v) => (o.first = v)),
      tRow("Between groups", "after you kill a group", w.groupPause ?? 0.5, (o, v) => (o.groupPause = v)),
      tRow("Between waves", "after the last group of a wave", w.pause ?? w.gap ?? 2, (o, v) => (o.pause = v))),
    h("div", { class: "wv-sect" }, h("h4", {}, "Each new wave"),
      toggle(w.hp !== false, "Refill HP", (w.hpAmount ?? 100) >= 100 ? "Health and armor back to full (not between groups)" : `+${w.hpAmount} HP, up to 100 (armor is not refilled)`, W((o, v) => (o.hp = v))),
      // wave-hp-amount-v1: how much HP the wave refill gives (100 = full health + armor)
      w.hp !== false ? tRow("Amount", "100 = full, with armor", w.hpAmount ?? 100, (o, v) => (o.hpAmount = Math.max(10, Math.min(100, Math.round(v)))), "HP", 10, 100, 1) : null,
      r.ammo ? toggle(w.ammo !== false, "Refill magazine", null, W((o, v) => (o.ammo = v))) : null),
    h("div", { class: "wv-sect" }, h("h4", {}, "After the last wave"),
      seg([[false, "Round ends"], [true, "Start again"]], !!w.repeat, setW((o, v) => (o.repeat = v))),
      h("p", { class: "wv-hint" }, w.repeat ? "Wave A comes again after the last wave, until the time is up." : "The round ends as soon as the last wave is cleared.")));
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
    randomStartsGroup(),
    floorPicker(st, (d, y) => (d.start.y = y)),
  ];
}

// Your start panel: "Random starts" (more places you can start; each round uses one at random).
function randomStartsGroup() {
  const n = (S.drill.start.spots || []).length;
  const help = n
    ? `${n + 1} starts. Each round you start at one of them at random (a replay uses the same one). Drag the dashed green rings to move them and their green dot to set where you look; right-click or Backspace removes one.`
    : "Only this start. Add more and each round you start at a random one, so you can't play the same opening every time.";
  return h("div", { class: "group" }, field("Random starts", h("div", {},
    h("p", { class: "help" }, help),
    h("div", { class: "btn-row" },
      h("button", { class: "btn small" + (S.addStart ? " primary" : ""), onclick: () => { S.addStart = !S.addStart; S.addSpot = false; S.addPoint = false; S.tool = null; renderSide(); draw(); } }, ic("plus"), S.addStart ? "Click the map… (Esc to stop)" : "Add a start"),
      n ? h("button", { class: "btn small", onclick: () => removeStart(n - 1) }, ic("minus"), "Remove last start") : null))));
}
// Drops another start where you clicked, looking the same way as your main start.
function addStartAt(at) {
  const x = at.stand ? at.x : Math.round(at.x * 10) / 10, z = at.stand ? at.z : Math.round(at.z * 10) / 10;
  edit((d) => { d.start.spots = [...(d.start.spots || []), { x, y: at.stand ? at.y : floorAt(x, z, at.y ?? d.start.y) ?? (at.y ?? 0), z, facing: d.start.facing || 0 }]; });
  S.startSel = (S.drill.start.spots || []).length - 1;
  renderSide();
}
function removeStart(index) {
  edit((d) => { d.start.spots = (d.start.spots || []).filter((_, j) => j !== index); });
  const n = (S.drill.start.spots || []).length;
  S.startSel = n ? Math.max(0, Math.min(n - 1, index - 1)) : null;
  renderSide(); draw();
}
function botPanel(b) {
  if (isDot(b)) return dotPanel(b);
  const m = MOVES[b.move];
  const d = S.drill;
  const clear = d.round.goal === "clear";
  const fromYou = dist(b, d.start);
  const set = (fn) => (v) => edit(mod((it) => fn(it, v)));
  const out = [
    ...head(b.move, "ic-bot", itemName(d, b), m.tip),
    h("div", { class: "stat" }, h("span", {}, h("b", {}, `${fromYou.toFixed(0)} m`), " from you"),
      b.shoots !== "off" ? h("span", {}, "Shoots ", rankIcon(b.shoots)) : null),
    h("div", { class: "btn-row bot-lib-row" },
      h("button", { class: "btn small", title: "Save this bot's settings to reuse in any drill", onclick: () => saveBotToLibrary(b) }, ic("plus"), "Save to library"),
      h("button", { class: "btn small", title: "Give this bot the settings of a saved bot", onclick: () => useSavedBot(b) }, ic("copy"), "Load saved")),
    h("div", { class: "group" },
      field("What it does", seg(Object.entries(MOVES).map(([k, v]) => [k, v.short, v.label]), b.move, (v) => changeMove(b, v)))),
    // When it appears (with the round / a line / a trade) comes right after what it does, then where.
    h("div", { class: "group" }, showsUpField(b, d)),
    randomSpotsGroup(b),
    randomZoneGroup(b),
  ];
  const moveGroup = h("div", { class: "group" });
  const speed = h("div", {},
    field("Speed", seg([["walk", "Walk"], ["run", "Run"]], b.speed, set((it, v) => (it.speed = v)))),
    // bot-speed-v1: like copycat's Speed slider, scales Walk / Run (also strafes and peek A-D steps).
    field("Speed multiplier", h("div", {},
      slider(SPEED_SCALE[0], SPEED_SCALE[1], 0.05, speedScale(b), (v) => `${v.toFixed(2)}×${Math.abs(v - defaultSpeedScale(b)) < 1e-9 ? " (default)" : ""}`, (dd, v) => mod((it) => (it.speedScale = v))(dd)),
      Number.isFinite(b.speedScale) ? h("button", { class: "btn small", onclick: () => { edit(mod((it) => (it.speedScale = null))); renderSide(); } }, "Use default") : null),
      h("span", {}, h("b", {}, "! Default: 1.25× with no gun, 1× with a gun in hand."), " 1.25× is your own speed with no gun (6.75 m/s), 1× your speed with a Vandal (5.4 m/s). Also speeds up or slows down strafes and peeks.")));
  if (b.move === "strafe") {
    moveGroup.append(
      field("Movement", seg([[false, "Predictable"], [true, "Unpredictable"]], b.unpredictable === true, set((it, v) => (it.unpredictable = v))), "Unpredictable mixes short taps and longer strafes with short, random pauses, always at full speed, within the movement width."),
      field("How wide", slider(0.4, 12, 0.1, b.width, metres, (dd, v) => mod((it) => (it.width = v))(dd)), (() => { const r = wallInfo(b)?.room; return r && r.limited ? `A wall is in the way: it strafes ${r.width} m here (the red part is cut off). Or drag the orange end dots on the map.` : "Or drag the orange end dots on the map."; })()), // bot-walls-v1
      speed);
  } else if (b.move === "peek") {
    moveGroup.append(...[
      field("At the peek", seg([[true, "Strafes A-D"], [false, "Holds still"], ["random", "Random", "Strafes or holds still, picked again every time it comes out"]],
        b.peekStrafe === "random" ? "random" : !!b.peekStrafe, set((it, v) => (it.peekStrafe = v))),
        b.peekStrafe === "random" ? "Every time it comes out (after a kill or after hiding) it's a coin flip: strafe or hold still." : null),
      b.peekStrafe ? field("How wide", slider(0.4, 8, 0.1, peekWidth(b), metres, (dd, v) => mod((it) => { it.peekWidth = v; for (const q of it.spots || []) delete q.peekWidth; })(dd)),
        `How far it strafes A-D at the peek spot, end to end (default ${PEEK_WIDTH.toFixed(1)} m). This sets every spot; drag the orange dots at a spot to change just that one.`) : null,
      field("Time out in the open", slider(0.3, 60, 0.1, b.wait, secs, (dd, v) => mod((it) => (it.wait = v))(dd)), "Then it walks back behind cover."),
      // A flashing peeker hides behind cover for this long too, then flashes and peeks again.
      takingTurns() || b.tradeOf ? null : field("Time behind cover", slider(0.2, 5, 0.1, b.coverWait ?? 1, secs, (dd, v) => mod((it) => (it.coverWait = v))(dd)), "Before it peeks again."),
      takingTurns() || b.tradeOf ? null : field("Random extra wait",
        slider(0, 5, 0.1, b.randomWait || 0, (v) => (v ? `0–${v.toFixed(1)} s` : "Off"), (dd, v) => mod((it) => (it.randomWait = v))(dd)),
        "Each peek waits Time behind cover plus a random 0 to this many seconds, so you can't time it. The first peek is random too."),
      // peek-facing-v1: which way it looks at the peek, and so which way its A-D strafe runs.
      field("Faces", seg([[false, "Always faces you"], [true, "A direction I pick"]], typeof b.peekFacing === "number",
        (v) => edit(mod((it) => (it.peekFacing = v ? Math.round(yawDeg(it.route && it.route[1] ? it.route[1] : it, S.drill.start)) : null)))),
        typeof b.peekFacing === "number"
          ? `Holds that direction while it peeks${b.peekStrafe ? " and strafes A-D along its own left and right" : ""}. Drag the white dot in front of the bot on the map, or use the slider.`
          : `It turns to keep facing you${b.peekStrafe ? "; its A-D strafe runs across your view" : ""}.`),
      typeof b.peekFacing === "number" ? slider(0, 359, 1, b.peekFacing, (v) => `${v}°`, (dd, v) => mod((it) => (it.peekFacing = v))(dd)) : null,
      speed,
      h("p", { class: "help" }, "On the map: point 1 (green) is cover, point 2 is the peek spot. Drag them. Put a wall between point 1 and you."),
    ].filter(Boolean));
  } else if (b.move === "cross" || b.move === "patrol") {
    moveGroup.append(speed, field(b.move === "cross" || (b.flash && b.flash.on) ? "Route (appears at 1, disappears at the last point)" : "Route (loops back to 1)", routeList(b)));
  } else if (b.move === "copycat") {
    moveGroup.append(...copycatControls(b));
  } else {
    moveGroup.append(h("p", { class: "help" }, "Stands on its spot, facing your start."));
  }
  if ((b.move === "still" || b.move === "strafe" || b.move === "peek") && !isDot(b)) {
    moveGroup.append(field("Pose", seg([[false, "Standing"], [true, "Crouching"]], b.crouch, set((it, v) => { it.crouch = v; it.crouchRandom = false; })),
      b.move === "peek" ? "Crouching stays low for the peek and return. Movement speed still follows Walk / Run." : null));
  }
  if (b.move === "still" || b.move === "strafe") {
    const fixed = typeof b.facing === "number";
    moveGroup.append(field("Faces", seg([[false, "Always faces you"], [true, "A direction I pick"]], fixed,
      (v) => edit(mod((it) => (it.facing = v ? Math.round(yawDeg(it, S.drill.start)) : null)))),
    fixed ? "Drag the white dot in front of the bot on the map, or use the slider. It strafes along its own left and right." : "It turns to keep facing you."));
    if (fixed) moveGroup.append(slider(0, 359, 1, b.facing, (v) => `${v}°`, (dd, v) => mod((it) => (it.facing = v))(dd)));
  }
  out.push(moveGroup);
  // A copycat jumps and crouches when you did; the timed options don't apply.
  const copycat = b.move === "copycat";
  out.push(h("div", { class: "group" },
    field(null, toggle(b.hitSlow === true, "Slows when hit", "Surviving bullet hits briefly slow this bot's movement.", (dd, v) => mod((it) => (it.hitSlow = v))(dd))),
    copycat ? null : field(null, toggle(b.jump === true, "Jumps", "Jumps during Play while keeping its selected movement and route.", (dd, v) => mod((it) => (it.jump = v))(dd))),
    ...(b.jump && !copycat ? [
      field("Jump height", h("div", {},
        slider(0.2, 2, 0.05, b.jumpHeight ?? DEFAULT_JUMP_HEIGHT, (v) => `${v.toFixed(2)} m`, (dd, v) => mod((it) => (it.jumpHeight = v))(dd)),
        h("button", { class: "btn small", onclick: () => edit(mod((it) => (it.jumpHeight = DEFAULT_JUMP_HEIGHT))) }, "Reset to 1.15 m")), "Default: 1.15 m (your normal jump)."),
      field("Minimum wait between jumps", slider(0.5, 10, 0.1, b.jumpMin ?? 1.5, secs, (dd, v) => mod((it) => { it.jumpMin = v; it.jumpMax = Math.max(v, it.jumpMax ?? 3); })(dd))),
      field("Maximum wait between jumps", slider(0.5, 10, 0.1, b.jumpMax ?? 3, secs, (dd, v) => mod((it) => { it.jumpMax = v; it.jumpMin = Math.min(v, it.jumpMin ?? 1.5); })(dd)), "The bot waits this long after landing before its next jump."),
    ] : [])));
  const dot = isDot(b);
  if (!copycat && !dot) out.push(h("div", { class: "group" },
    field(null, toggle(b.crouchRandom === true, "Occasional crouching", "Randomly crouches and stands during Play. Uses the player's crouch transition; waits for jumping to finish.", (dd, v) => mod((it) => { it.crouchRandom = v; if (v) it.crouch = false; })(dd))),
    ...(b.crouchRandom ? [
      field(null, toggle(b.crouchStill !== false, "Only when fully stopped", "Waits until the bot has fully stopped before it crouches, so it stays accurate. A strafer stays stopped until it stands back up.", (dd, v) => mod((it) => (it.crouchStill = v))(dd))),
      field("Minimum crouch hold", slider(0.3, 10, 0.1, b.crouchMin ?? 0.5, secs, (dd, v) => mod((it) => { it.crouchMin = v; it.crouchMax = Math.max(v, it.crouchMax ?? 1.2); })(dd))),
      field("Maximum crouch hold", slider(0.3, 10, 0.1, b.crouchMax ?? 1.2, secs, (dd, v) => mod((it) => { it.crouchMax = v; it.crouchMin = Math.min(v, it.crouchMin ?? 0.5); })(dd)), "Time fully crouched before standing up."),
      field("Minimum wait between crouches", slider(0.3, 10, 0.1, b.crouchGapMin ?? 2, secs, (dd, v) => mod((it) => { it.crouchGapMin = v; it.crouchGapMax = Math.max(v, it.crouchGapMax ?? 4); })(dd))),
      field("Maximum wait between crouches", slider(0.3, 10, 0.1, b.crouchGapMax ?? 4, secs, (dd, v) => mod((it) => { it.crouchGapMax = v; it.crouchGapMin = Math.min(v, it.crouchGapMin ?? 2); })(dd)), "Time standing before the next crouch."),
    ] : [])));
  if (b.route && !dot) out.push(flashGroup(b));

  if (!dot) out.push(h("div", { class: "group" },
    field("Shoots back", rankGrid(b.shoots, (v) => edit(mod((it) => { it.shoots = v; if (v !== "off" && !it.weapon) it.weapon = "vandal"; }))),
      b.shoots === "off" ? "Pick a rank and it shoots back like a player of that rank." : `Reacts in about ${RANKS.find((r) => r[0] === b.shoots)[2].reaction[0].toFixed(2)} s${RANKS.find((r) => r[0] === b.shoots)[2].heads ? " and goes for your head" : ""}.${d.round.die ? "" : " Turn on \"Bots can kill me\" in drill settings for real danger."}`)));

  out.push(h("div", { class: "group" },
    field("After a kill", b.tradeOf ? h("p", { class: "help" }, "Stays dead until you kill the bot it trades again (see Shows up).") : clear ? h("p", { class: "help" }, "Stays dead (the goal is Clear them all).") :
      h("div", {}, seg([[true, "Comes back"], [false, "Stays dead"]], b.back, set((it, v) => (it.back = v))),
        b.back ? (takesTurn(b) ? h("p", { class: "help" }, TURN_BACK_HELP) : slider(0, 8, 0.1, b.backAfter, (v) => (v === 0 ? "right away" : `after ${secs(v)}`), (dd, v) => mod((it) => (it.backAfter = v))(dd))) : null)),
    dot ? null : field("Toughness", seg(ARMOR.map(([v, l]) => [v, l.split(" (")[0], l]), b.hp, set((it, v) => (it.hp = v))))));

  if (!dot) out.push(h("div", { class: "group" },
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

// dot-bots-v2: where a dot goes for a point you picked. at.normal (3D): a wall face -> stuck on it at that height;
// a floor or top -> head height above it. No normal (2D map): that spot at its current height. Either way, a wall face
// within reach pulls it on (dotWallSnap); off a wall it faces you again. free (Alt in 2D): no wall pull.
function setDotSpot(it, at, d, free = false, dragging = false) {
  const r = dotRadius(it), q = (v) => Math.round(v * 1000) / 1000;
  const n = at.normal, flat = n ? Math.hypot(n.x, n.z) : 0;
  const stick = (x, z, nx, nz) => { it.x = q(x); it.z = q(z); it.wall = { x: q(nx), z: q(nz) }; it.facing = Math.round(yawDeg(it, { x: it.x + nx, z: it.z + nz })); };
  const floorUnder = (x, z, y) => { const f = floorAt(x, z, y); return f !== null && f !== undefined && f <= y + 0.05 ? f : y - DOT_HEIGHT; };
  if (n && Math.abs(n.y) < 0.5 && flat > 0) {
    const nx = n.x / flat, nz = n.z / flat, x = at.x + nx * (r + 0.02), z = at.z + nz * (r + 0.02);
    it.y = q(floorUnder(x, z, at.y));
    it.dotHeight = Math.round(Math.max(0.2, Math.min(DOT_MAX_HEIGHT, at.y - it.y)) * 100) / 100;
    stick(x, z, nx, nz);
    return;
  }
    if (n && dragging && n.y > 0.5) {
    // Same height in the world as before (over a box it doesn't jump up; it just can't go into the box).
    const world = (it.y || 0) + dotHeight(it), floor = floorUnder(at.x, at.z, at.y);
    it.y = q(floor); it.dotHeight = Math.round(Math.max(0.2, Math.min(DOT_MAX_HEIGHT, world - floor)) * 100) / 100;
  }
  else if (n) { it.y = q(at.y); it.dotHeight = DOT_HEIGHT; }
  else it.y = floorAt(at.x, at.z, it.y ?? 0) ?? it.y ?? 0;
  it.x = q(at.x); it.z = q(at.z);
  const snapTo = free ? null : dotWallSnap(d, it.x, it.z, (it.y || 0) + dotHeight(it), r, dragging ? 0.3 : n ? 0.4 : 1);
  if (snapTo) stick(snapTo.x, snapTo.z, snapTo.normal.x, snapTo.normal.z);
  else { it.wall = null; it.facing = null; }
}

// dot-bots-v2: the Dot card's own panel: size, still or side to side, when it shows up, after a kill.
function dotPanel(b) {
  const d = S.drill, clear = d.round.goal === "clear";
  const set = (fn) => (v) => edit(mod((it) => fn(it, v)));
  const onWall = !!(b.wall && Number.isFinite(b.wall.x));
  const out = [
    ...head("dot", "ic-bot", itemName(d, b), "A ball like in Aim Lab. One hit kills it. Its color is the arena's Targets color."),
    h("div", { class: "stat" }, h("span", {}, h("b", {}, `${dist(b, d.start).toFixed(0)} m`), " from you"),
      h("span", {}, onWall ? "Stuck on a wall" : "Floating", " · ", h("b", {}, `${dotHeight(b).toFixed(1)} m`), " up")),
    h("div", { class: "group" },
      field("Size", seg([["small", "Small"], ["medium", "Medium"], ["large", "Large"]], TARGET_SIZES[b.dotSize] ? b.dotSize : "medium", set((it, v) => (it.dotSize = v))),
        `${Math.round(dotRadius(b) * 200)} cm wide.`),
      // dot-bots-v4: up / down arrows (0.1 m; Shift 1 m). In 3D the white arrows above and below the ball do the same.
      field("Height", h("div", { class: "dot-height" },
        h("button", { type: "button", class: "btn small", title: "Lower (Shift: 1 m)", onclick: (e) => edit(mod((it) => (it.dotHeight = Math.round(Math.max(0.2, dotHeight(it) - (e.shiftKey ? 1 : 0.1)) * 100) / 100))) }, "▼"),
        h("b", {}, `${dotHeight(b).toFixed(1)} m`),
        h("button", { type: "button", class: "btn small", title: "Higher (Shift: 1 m)", onclick: (e) => edit(mod((it) => (it.dotHeight = Math.round(Math.min(DOT_MAX_HEIGHT, dotHeight(it) + (e.shiftKey ? 1 : 0.1)) * 100) / 100))) }, "▲")),
        "Middle of the ball above the floor. In 3D, drag the white arrows above and below it.")),
  ];
  const moves = h("div", { class: "group" },
    field("Moves", seg([["still", "Still"], ["strafe", "Side to side"]], b.move === "strafe" ? "strafe" : "still", set((it, v) => (it.move = v))),
      b.move !== "strafe" ? null : onWall ? "Moves left and right along the wall." : "Moves left and right across your view."));
  if (b.move === "strafe") moves.append(
    field("Movement", seg([[false, "Predictable"], [true, "Unpredictable"]], b.unpredictable === true, set((it, v) => (it.unpredictable = v)))),
    field("How wide", slider(0.4, 12, 0.1, b.width, metres, (dd, v) => mod((it) => (it.width = v))(dd)), "Or drag the orange end dots on the map."),
    field("Speed", seg([["walk", "Walk"], ["run", "Run"]], b.speed, set((it, v) => (it.speed = v)))),
    field("Speed multiplier", h("div", {},
      slider(SPEED_SCALE[0], SPEED_SCALE[1], 0.05, speedScale(b), (v) => `${v.toFixed(2)}×${Math.abs(v - defaultSpeedScale(b)) < 1e-9 ? " (default)" : ""}`, (dd, v) => mod((it) => (it.speedScale = v))(dd)),
      Number.isFinite(b.speedScale) ? h("button", { class: "btn small", onclick: () => { edit(mod((it) => (it.speedScale = null))); renderSide(); } }, "Use default") : null)));
  out.push(moves,
    h("div", { class: "group" }, showsUpField(b, d)),
    // dot-spots-v1: extra spots and a random zone, both sticking to walls like the dot.
    randomSpotsGroup(b),
    randomZoneGroup(b),
    h("div", { class: "group" },
      field("After a kill", clear ? h("p", { class: "help" }, "Stays dead (the goal is Clear them all).") :
        h("div", {}, seg([[true, "Comes back"], [false, "Stays dead"]], b.back, set((it, v) => (it.back = v))),
          b.back ? (takesTurn(b) ? h("p", { class: "help" }, TURN_BACK_HELP) : slider(0, 8, 0.1, b.backAfter, (v) => (v === 0 ? "right away" : `after ${secs(v)}`), (dd, v) => mod((it) => (it.backAfter = v))(dd))) : null))),
    h("p", { class: "help" }, "Drag it on the map. Near a wall (or on one in 3D) it sticks to the wall; hold Alt in 2D to keep it off."),
    actions());
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
  // Very high / Highest are only for Reyna and KAY/O; other agents drop back to High.
  box.append(field("Whose flash", agentGrid(FLASH_AGENTS, agent[0], setF((fl, v) => { fl.agent = v; if (v === "kayo") fl.height = 0; const hs = flashHeights(v), cur = fl.height ?? 2.2; if (v !== "breach" && !hs.some((hh) => hh[0] === cur)) fl.height = hs.filter((hh) => hh[0] <= 3.5).reduce((a, hh) => (Math.abs(hh[0] - cur) < Math.abs(a - cur) ? hh[0] : a), 2.2); })), `${agent[1]}. ${agent[2]}`));
  if (agent[0] === "kayo") box.append(field("Throw", seg([["over", "Overhand (1.3 s)"], ["under", "Underhand (0.7 s)"]], f.throw === "under" ? "under" : "over", setF((fl, v) => { if (v === "under") fl.throw = "under"; else delete fl.throw; }))));
  if (agent[3]) box.append(field("Throw", seg(agent[3], agent[3].some((c) => c[0] === f.curve) ? f.curve : agent[3][0][0], setF((fl, v) => (fl.curve = v)))));
  if (b.move !== "peek") {
    const choices = b.route.slice(1).map((_, i) => [i + 1, `Point ${i + 2}`]);
    box.append(field("Throws it from", seg(choices, Math.min(f.at || 1, b.route.length - 1), setF((fl, v) => (fl.at = v)))));
  }
  const aimed = agent[0] === "yoru" && f.hit && f.normal;
  if (aimed) box.append(field("Aimed with the mouse", h("div", {},
    h("p", { class: "help" }, `Bounces off the ${Math.abs(f.normal.y) > 0.7 ? (f.normal.y > 0 ? "floor" : "ceiling") : "wall"} you dropped the star on, ${f.hit.y.toFixed(2)} m up. Drag the star in 3D to move it.`),
    h("button", { class: "btn small", onclick: () => edit(mod((it) => { delete it.flash.hit; delete it.flash.normal; })) }, "Stop aiming, use Bounces off"))));
  else if (agent[0] === "yoru") box.append(field("Bounces off", seg([["wall", "A wall"], ["floor", "The floor"]], f.bounce === "floor" ? "floor" : "wall", setF((fl, v) => (fl.bounce = v))),
    f.bounce === "floor" ? "Put the star on the floor where it should bounce. It flies up and pops 0.6 s after the bounce. For full control, drag the star in the 3D view onto any wall, floor or box." : "Put the star on the wall where it should bounce, at the height below. It comes back off the wall and pops 0.6 s after the bounce. For full control, drag the star in the 3D view onto any wall, floor or box."));
  const yoruFloor = agent[0] === "yoru" && (f.bounce === "floor" || aimed);
  box.append(...[
    agent[0] === "phoenix" ? h("p", { class: "help" }, `Drag the star anywhere: the curve bends to pop there, 0.6 s after the throw. The dotted circle is the real VALORANT reach (${PHOENIX_REACH.toFixed(1)} m). In a round it bounces off walls in its way.`) : null,
    yoruFloor ? null : field(agent[0] === "yoru" ? "Hits the wall at" : agent[0] === "kayo" ? "Aims at" : "Pops at", agent[0] === "breach"
        ? slider(0.5, 4, 0.1, f.height ?? 2.2, (v) => `${v.toFixed(1)} m`, (dd, v) => mod((it) => (it.flash.height = Math.round(v * 10) / 10))(dd))
        : seg(flashHeights(agent[0]), f.height ?? 2.2, setF((fl, v) => (fl.height = v))),
      agent[0] === "reyna" ? `Height above the bot's floor. The eye flies straight through walls and stops after ${REYNA_REACH} m (red ring on the map if the star is further).`
        : agent[0] === "kayo" ? "Where the bot aims, above its floor (the star). Like in VALORANT it flies at 18 m/s, bounces off what it hits and pops 0.5 s after the first bounce, or 1.3 s after the throw (underhand 0.7 s). Floor: it bounces at the star and pops near it."
        : agent[0] === "breach" ? "Height above the bot's floor where it comes out of the wall." : null),
    field("Waits after throwing", slider(0.3, 2.5, 0.1, f.wait ?? 1, secs, (dd, v) => mod((it) => (it.flash.wait = v))(dd)), "0.7 to 1.8 s feels like a real player: shorter and it runs into its own flash."),
    h("div", {},
      h("p", { class: "help" }, agent[0] === "phoenix" ? "Reset flash: back to the real reach toward your start spot, curving right, head height, default wait." : "Drag the white star on the map to where the flash should pop. Press Preview moves to watch it. Reset flash puts it back in front of the bot."),
      h("button", { class: "btn small", onclick: () => edit(mod((it) => { const fl = it.flash; fl.target = null; delete fl.hit; delete fl.normal; fl.curve = agent[3] ? agent[3][0][0] : fl.curve; fl.height = agent[0] === "kayo" ? 0 : 2.2; delete fl.throw; fl.wait = 1; fl.bounce = "wall"; })) }, "Reset flash")),
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
    it.spots = []; // extra spots carry routes of the old type
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
  S.addPoint = false; S.addSpot = false;
}

// ---------- copycat runs ----------
const RECORDING_KEY = "studio-recording", TAKE_KEY = "studio-take";

// A recorded run in words: length, distance, jumps, crouches, bursts fired.
function runSummary(track) {
  const p = track.p;
  let metres = 0, jumps = 0, crouches = 0, bursts = 0;
  for (let i = 6; i < p.length; i += 6) {
    metres += Math.hypot(p[i] - p[i - 6], p[i + 2] - p[i - 4]);
    if (p[i + 5] && !p[i - 1]) jumps++;
    if (p[i + 3] > 0.5 && p[i - 3] <= 0.5) crouches++;
    if (p[i + 4] && !p[i - 2]) bursts++;
  }
  const n = (v, one, many) => `${v} ${v === 1 ? one : many}`;
  const smokes = Array.isArray(track.smokes) ? track.smokes.length : 0;
  return `${secs(track.secs)}, ${metres.toFixed(1)} m moved, ${n(jumps, "jump", "jumps")}, ${n(crouches, "crouch", "crouches")}, fired ${n(bursts, "time", "times")}${smokes ? `, ${n(smokes, "smoke", "smokes")}` : ""}`;
}

// ---------- run library (saved copycat runs, studio-store.js) ----------
const placeLabel = (place) => (place && place !== "range" ? mapLabel(place) : "Training range");

// A small drawing of a run seen from above, "toward you" pointing up: big dot where it
// starts, white dots where it jumps, red dots where you fired.
function runThumb(track, w = 132, hgt = 84) {
  const c = h("canvas", { class: "run-thumb", width: w * 2, height: hgt * 2, style: `width:${w}px;height:${hgt}px` });
  const g = c.getContext("2d"), p = track.p;
  let x0 = 0, x1 = 0, z0 = 0, z1 = 0;
  for (let i = 0; i < p.length; i += 6) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]); }
  const k = Math.min((w * 2 - 28) / Math.max(1, x1 - x0), (hgt * 2 - 28) / Math.max(1, z1 - z0));
  const at = (i) => [w + (p[i] - (x0 + x1) / 2) * k, hgt - (p[i + 2] - (z0 + z1) / 2) * k];
  const dot = (i, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(...at(i), r, 0, Math.PI * 2); g.fill(); };
  g.strokeStyle = COLORS.route; g.lineWidth = 3; g.lineJoin = "round";
  g.beginPath();
  for (let i = 0; i < p.length; i += 6) (i ? g.lineTo(...at(i)) : g.moveTo(...at(i)));
  g.stroke();
  dot(0, 8, "#ffffff"); dot(0, 6, COLORS.bot);
  for (let i = 6; i < p.length; i += 6) {
    if (p[i + 5] && !p[i - 1]) dot(i, 5, "#ffffff");
    else if (p[i + 4] && !p[i - 2]) dot(i, 4, COLORS.bot);
  }
  return c;
}

// A text box in a dialog: the trimmed name, or null when cancelled.
function askName(title, text, value, okLabel) {
  return new Promise((resolve) => {
    const close = (v) => { scrim.remove(); resolve(v); };
    const input = h("input", {
      class: "text-input", value, maxlength: 40, "aria-label": "Name", spellcheck: "false",
      onkeydown: (e) => { if (e.key === "Enter") close(input.value.trim() || value); if (e.key === "Escape") close(null); },
    });
    const scrim = h("div", { class: "scrim", onclick: (e) => e.target === scrim && close(null) },
      h("div", { class: "dialog small", role: "dialog", "aria-modal": "true" },
        h("h2", {}, title), h("p", { class: "sub" }, text), input,
        h("div", { class: "foot" },
          h("button", { class: "btn", onclick: () => close(null) }, "Cancel"),
          h("button", { class: "btn primary", onclick: () => close(input.value.trim() || value) }, okLabel))));
    document.body.append(scrim);
    input.focus(); input.select();
  });
}

// Saves a copy of a run to the library; returns the saved run, or null.
async function saveRunToLibrary(track) {
  const name = await askName("Save to run library", "Give it a name you'll recognise, for example \"wide swing\" or \"jiggle peek\".", track.name || "My run", "Save");
  if (name === null) return null;
  try {
    const run = await api.saveRun({ name, place: S.drill.place, track: cutTrack(track) }); // the kept part only
    toast(`Saved "${run.name}" to your runs.`);
    return run;
  } catch (err) {
    toast(`Couldn't save the run: ${err && err.message}`, true);
    return null;
  }
}

// Gives the copycat a copy of a saved run, so the drill never depends on the library.
async function useSavedRun(b) {
  let runs = [];
  try { runs = await api.runs(); } catch {}
  if (!runs.length) { toast("No saved runs yet. Record a run and press Save to library."); return; }
  const here = S.drill.place;
  const pick = await new Promise((resolve) => {
    const close = (v) => { scrim.remove(); resolve(v); };
    const scrim = h("div", { class: "scrim", onclick: (e) => e.target === scrim && close(null) },
      h("div", { class: "dialog", role: "dialog", "aria-modal": "true" },
        h("h2", {}, "Use a saved run"),
        h("p", { class: "sub" }, `${itemName(S.drill, b)} gets its own copy. Renaming or deleting the saved run later doesn't change this drill.`),
        h("div", { class: "run-list" }, runs.map((r) => h("button", { class: "run-row", onclick: () => close(r) },
          runThumb(r.track),
          h("span", { class: "run-text" },
            h("b", {}, r.name), h("small", {}, runSummary(r.track)),
            h("small", { class: r.place === here ? "" : "warn" }, r.place === here ? `Recorded on ${placeLabel(r.place)}` : `Recorded on ${placeLabel(r.place)}: check it doesn't run through walls here`))))),
        h("div", { class: "foot" }, h("button", { class: "btn", onclick: () => close(null) }, "Cancel"))));
    document.body.append(scrim);
  });
  if (!pick) return;
  S.scrub = null;
  edit(mod((it) => (it.track = { hz: pick.track.hz, secs: pick.track.secs, p: [...pick.track.p], name: pick.name })));
}

// ---------- bot library (saved bots, studio-store.js) ----------
// A saved bot is a bot's settings (everything on its panel) without where it stands: its spot,
// route, trigger line, fixed facing and flash target belong to one map. Using it copies the
// settings into the drill, so drills never depend on the library.
let savedBots = [];
let savedBotsEl = null;
const NOT_SAVED = ["id", "kind", "move", "x", "y", "z", "route", "trigger", "facing", "spots", "tradeOf"];

function botSettings(b) {
  const s = JSON.parse(JSON.stringify(b));
  for (const k of NOT_SAVED) delete s[k];
  if (s.flash) s.flash.target = null;
  return s;
}

function savedBotSummary(p) {
  const s = p.settings, bits = [];
  if (p.move === "peek") bits.push(`${(s.wait ?? 1.2).toFixed(1)} s out`, `${(s.coverWait ?? 1).toFixed(1)} s cover`, s.peekStrafe === "random" ? "strafes or holds" : s.peekStrafe ? `strafes ${peekWidth(s).toFixed(1)} m` : "holds");
  if (p.move === "strafe") bits.push(`${s.width ?? 3} m wide`);
  if (p.move === "copycat") bits.push(s.track ? `${Math.round(cutTrack(s.track).secs)} s run` : "no run");
  if (p.move !== "still" && p.move !== "copycat") bits.push((s.speed === "walk" ? "walk" : "run") + ` ${speedScale(s).toFixed(2)}×`);
  if (s.form === "dot") bits.push(`dot ${s.dotSize || "medium"}`);
  if (s.crouch) bits.push("crouching");
  if (s.flash && s.flash.on) bits.push("flash");
  const rank = RANKS.find((r) => r[0] === s.shoots);
  bits.push(s.shoots && s.shoots !== "off" ? `shoots: ${rank ? rank[1] : s.shoots}` : "doesn't shoot");
  return bits.join(" · ");
}

async function loadSavedBots() {
  try { savedBots = await api.bots(); } catch { savedBots = []; }
  renderSavedBots();
}

// The tray's "Saved bots": one group per bot type, each saved bot placed like any tray item.
// Which "Saved bots" groups are open (closed by default; remembered on this computer).
const SAVED_OPEN_KEY = "studio-saved-open";
const savedOpen = new Set((() => { try { return JSON.parse(localStorage.getItem(SAVED_OPEN_KEY) || "[]"); } catch { return []; } })());
function setSavedOpen(move, open) {
  if (open) savedOpen.add(move); else savedOpen.delete(move);
  try { localStorage.setItem(SAVED_OPEN_KEY, JSON.stringify([...savedOpen])); } catch {}
  renderSavedBots();
}

function renderSavedBots() {
  if (!savedBotsEl) return;
  savedBotsEl.textContent = "";
  for (const [move, m] of Object.entries(MOVES)) {
    const mine = savedBots.filter((p) => p.move === move);
    const open = mine.length > 0 && savedOpen.has(move);
    savedBotsEl.append(h("div", { class: "saved-group" + (mine.length ? "" : " empty") + (open ? " open" : "") },
      h("button", {
        class: "saved-head", type: "button", disabled: !mine.length, "aria-expanded": String(open),
        title: mine.length ? (open ? `Hide saved ${m.short.toLowerCase()}s` : `Show saved ${m.short.toLowerCase()}s`) : `No saved ${m.short.toLowerCase()}s yet`,
        onclick: () => setSavedOpen(move, !open),
      }, ic("chev", "saved-arrow"), ic(move, "ic-bot"), h("span", {}, m.short), h("small", {}, String(mine.length))),
      !open ? null : mine.map((p) => {
        const btn = h("button", { class: "tool saved-tool", "data-tool": `saved:${p.id}`, title: `${p.name}: ${savedBotSummary(p)}. Click, then click the map, or drag it onto the map.` },
          h("div", {}, h("b", {}, p.name), h("span", {}, savedBotSummary(p))));
        btn.addEventListener("pointerdown", (e) => trayDown(e, { kind: "bot", move, saved: p }));
        return h("div", { class: "saved-bot" }, btn,
          h("div", { class: "saved-acts" },
            h("button", { class: "btn small icon", title: "Rename", "aria-label": `Rename ${p.name}`, onclick: () => renameSavedBot(p) }, ic("edit")),
            h("button", { class: "btn small icon danger", title: "Delete", "aria-label": `Delete ${p.name}`, onclick: () => deleteSavedBot(p) }, ic("trash"))));
      })));
  }
  if (!savedBots.length) savedBotsEl.append(h("p", { class: "saved-note" }, "Select a bot, then press Save to library in its settings."));
}

async function saveBotToLibrary(b) {
  const name = await askName("Save bot to library", `Saves this ${MOVES[b.move].short.toLowerCase()}'s settings (not where it stands) so you can add it to any drill.`, `My ${MOVES[b.move].short.toLowerCase()}`, "Save");
  if (name === null) return;
  try {
    const saved = await api.saveBot({ name, move: b.move, settings: botSettings(b) });
    savedOpen.add(b.move); // open its group so the new bot is visible
    try { localStorage.setItem(SAVED_OPEN_KEY, JSON.stringify([...savedOpen])); } catch {}
    toast(`Saved "${saved.name}" to your ${MOVES[b.move].short.toLowerCase()}s.`);
  } catch (err) {
    toast(`Couldn't save the bot: ${err && err.message}`, true);
  }
  loadSavedBots();
}

async function renameSavedBot(p) {
  const name = await askName("Rename saved bot", "Drills that already use it keep their copy.", p.name, "Rename");
  if (name === null || name === p.name) return;
  try { await api.renameBot({ id: p.id, name }); } catch (err) { toast(`Couldn't rename: ${err && err.message}`, true); }
  loadSavedBots();
}

async function deleteSavedBot(p) {
  const ok = await confirmBox(`Delete "${p.name}"?`, "It's removed from your saved bots. Drills that already use it keep their copy.", [["Cancel", null], ["Delete", "yes", "primary"]]);
  if (ok !== "yes") return;
  try { await api.removeBot(p.id); } catch (err) { toast(`Couldn't delete: ${err && err.message}`, true); }
  if (S.tool && S.tool.saved && S.tool.saved.id === p.id) setTool(null);
  loadSavedBots();
}

// Gives the selected bot a saved bot's settings (and its type); it keeps its spot.
async function useSavedBot(b) {
  await loadSavedBots();
  if (!savedBots.length) { toast("No saved bots yet. Press Save to library on a bot first."); return; }
  const pick = await new Promise((resolve) => {
    const close = (v) => { scrim.remove(); resolve(v); };
    const groups = Object.entries(MOVES).map(([move, m]) => {
      const mine = savedBots.filter((p) => p.move === move);
      return mine.length ? [h("h3", {}, m.short + (move === b.move ? " (same type)" : "")),
        h("div", { class: "run-list" }, mine.map((p) => h("button", { class: "run-row", onclick: () => close(p) },
          h("span", { class: "run-text" }, h("b", {}, p.name), h("small", {}, savedBotSummary(p))))))] : [];
    }).flat();
    const scrim = h("div", { class: "scrim", onclick: (e) => e.target === scrim && close(null) },
      h("div", { class: "dialog", role: "dialog", "aria-modal": "true" },
        h("h2", {}, "Use a saved bot"),
        h("p", { class: "sub" }, `${itemName(S.drill, b)} keeps its spot and gets the saved settings. A different type changes what it does.`),
        groups,
        h("div", { class: "foot" }, h("button", { class: "btn", onclick: () => close(null) }, "Cancel"))));
    document.body.append(scrim);
  });
  if (!pick) return;
  S.scrub = null;
  changeMove(b, pick.move);
  edit(mod((it) => Object.assign(it, JSON.parse(JSON.stringify(pick.settings)))));
  toast(`${itemName(S.drill, S.drill.items.find((i) => i.id === b.id))} now uses "${pick.name}".`);
}

function copycatControls(b) {
  const set = (fn) => (v) => edit(mod((it) => fn(it, v)));
  const t = b.track;
  const out = [field("Your run", h("div", {},
    h("p", { class: "help" }, t ? `${t.name ? `"${t.name}": ` : ""}${runSummary(cutTrack(t))}${t.cut ? ` (trimmed from ${secs(t.secs)})` : ""}` : `Plays the drill from this bot's spot, facing your start. Move however you like (up to ${RECORD_SECONDS} s), then press Esc and leave the round to come back here. Or use a run you saved.`),
    h("div", { class: "btn-row" },
      h("button", { class: "btn small" + (t ? "" : " primary"), onclick: () => recordRun(b) }, ic("rec"), t ? "Record again" : "Record my movement"),
      h("button", { class: "btn small", onclick: () => useSavedRun(b) }, ic("copy"), "Use a saved run"),
      t ? h("button", {
        class: "btn small", onclick: async () => {
          const run = await saveRunToLibrary(t);
          if (run && S.drill && S.drill.items.some((i) => i.id === b.id && i.track)) edit((d) => (d.items.find((i) => i.id === b.id).track.name = run.name));
        },
      }, ic("plus"), "Save to library") : null,
      t ? h("button", { class: "btn small", onclick: () => { S.scrub = null; edit(mod((it) => (it.track = null))); } }, ic("trash"), "Remove run") : null)))];
  if (!t) return out;
  out.push(
    trimControls(b),
    field("Preview the run", scrubber(b), "Drag to see where it is at each moment. Preview moves plays it."),
    field("Playback", seg(PLAYBACKS, b.playback || "loop", set((it, v) => (it.playback = v)))),
    field("Speed", slider(0.75, 1.25, 0.05, b.replaySpeed || 1, (v) => `${v.toFixed(2)}×`, (dd, v) => mod((it) => (it.replaySpeed = v))(dd)), "1× is exactly your speed."),
    field(null, toggle(b.mirror === true, "Mirror left and right", "Swaps its left and right: one recording, two different bots.", (dd, v) => mod((it) => (it.mirror = v))(dd))),
    field(null, toggle(b.randomStart === true, "Start anywhere on the run", "Each time it appears it starts from a random moment of the run, so it is harder to learn.", (dd, v) => mod((it) => (it.randomStart = v))(dd))),
    field("When it shoots", seg([["mine", "When I shot"], ["sees", "As soon as it sees you"]], b.fireWhen === "sees" ? "sees" : "mine", set((it, v) => (it.fireWhen = v))),
      b.fireWhen === "sees" ? "Stops its run to shoot when it sees you, like the other bots, then carries on." : "Fires only in the moments you fired while recording, and keeps moving. How well it shoots is set under Shoots back."));
  return out;
}

// copycat-trim-v1: keep only part of the recording (drill.js cutTrack). Dragging a handle shows the bot
// at that end of the kept part on the map. The recording stays whole; Reset brings it all back.
function trimControls(b) {
  const t = b.track, full = t.secs, [from, to] = trimRange(t);
  const setCut = (d, a, z) => {
    const it = d.items.find((i) => i.id === b.id);
    if (!it || !it.track) return;
    if (a <= 0 && z >= full) delete it.track.cut;
    else it.track.cut = [Math.round(a * 100) / 100, Math.round(z * 100) / 100];
  };
  const cur = () => trimRange(S.drill.items.find((i) => i.id === b.id)?.track || t);
  const startS = slider(0, Math.max(0, full - TRIM_MIN), 0.05, from, (v) => `from ${secs(v)}`, (d, v) => {
    const [, z] = cur(); setCut(d, v, Math.max(z, v + TRIM_MIN)); S.scrub = { id: b.id, t: 0 };
  });
  const endS = slider(TRIM_MIN, full, 0.05, to, (v) => `to ${secs(v)}`, (d, v) => {
    const [a] = cur(), lo = Math.min(a, v - TRIM_MIN); setCut(d, lo, v);
    // Just before the end (a looping run at exactly its length is back at its start); the preview applies Speed.
    S.scrub = { id: b.id, t: Math.max(0, (v - lo) / Math.max(0.75, Math.min(1.25, b.replaySpeed || 1)) - 0.02) };
  });
  const reset = t.cut ? h("button", { class: "btn small", onclick: () => { S.scrub = null; edit((d) => setCut(d, 0, full)); renderSide(); } }, "Use the whole run") : null;
  return field("Trim", h("div", {}, startS, endS, reset),
    `Keeps ${secs(to - from)} of ${secs(full)}. Cut slow walk-ups or the end after your peek. It appears where the kept part starts. To make the peek happen later in the round, use Shows up.`);
}

// Not an edit: only moves the selected copycat along its run on the map.
function scrubber(b) {
  const value = S.scrub && S.scrub.id === b.id ? S.scrub.t : 0;
  const out = h("output", {}, secs(value));
  const input = h("input", {
    type: "range", min: 0, max: cutTrack(b.track).secs, step: 0.05, value,
    oninput: (e) => { S.scrub = { id: b.id, t: +e.target.value }; out.textContent = secs(S.scrub.t); draw(); },
  });
  return h("div", { class: "slider" }, input, out);
}

// Recording: the game plays a scene that starts you on the bot's spot (compileRecording) and
// keeps your movement. Leaving the round brings you back here (studio-launch.js) with it.
async function recordRun(b) {
  if (!api.record) { toast("Recording needs the updated app. Close the game and start it again.", true); return; }
  const doc = compileRecording(S.drill, b, S.map ? (x, z, y) => floorAt(x, z, y) : null);
  if (gameCheck) {
    try {
      gameCheck(JSON.stringify(doc));
    } catch (err) {
      console.warn("Recording scene check:", err && err.message, doc);
      toast("The game couldn't read the recording scene.", true);
      return;
    }
  }
  try {
    const { code } = await api.record({ doc });
    try { sessionStorage.setItem(RECORDING_KEY, JSON.stringify({ bot: b.id })); } catch {}
    rememberEditor();
    location.assign(`/aim#studio-record=${code}`);
  } catch (err) {
    toast(`Couldn't start recording: ${err && err.message}`, true);
  }
}

// Back from recording: offer to keep what the game kept as the copycat's run.
async function takeRecording() {
  let pending = null, take = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(RECORDING_KEY) || "null");
    take = JSON.parse(sessionStorage.getItem(TAKE_KEY) || "null");
    sessionStorage.removeItem(RECORDING_KEY);
    sessionStorage.removeItem(TAKE_KEY);
  } catch {}
  if (!pending) return;
  api.clearRecording?.().catch(() => {});
  const bot = S.drill && S.drill.items.find((i) => i.id === pending.bot);
  if (!bot) return;
  S.sel = bot.id;
  renderSide(); draw(); focusOn(bot.id);
  const track = trackFromTake(take, bot, S.drill.start);
  if (!track) { toast("Nothing was recorded: you didn't move. Press Record my movement to try again.", true); return; }
  const pick = await confirmBox("Keep this run?", `${itemName(S.drill, bot)}: ${runSummary(track)}.`, [["Discard", null], ["Record again", "again"], ["Keep and save to library", "save"], ["Keep", "keep", "primary"]], { wide: true });
  if (pick === "keep" || pick === "save") { S.scrub = null; edit(mod((it) => (it.track = track))); }
  if (pick === "save") {
    const run = await saveRunToLibrary(track);
    if (run && S.drill.items.some((i) => i.id === bot.id && i.track)) edit((d) => (d.items.find((i) => i.id === bot.id).track.name = run.name));
  }
  if (pick === "again") recordRun(bot);
}

function routeList(b) {
  const box = h("div", { class: "points" });
  b.route.forEach((p, i) => {
    const last = i === b.route.length - 1;
    box.append(h("div", { class: "point" + (i === 0 ? " first" : last && b.move === "cross" ? " last" : "") },
      h("i", {}, String(i + 1)),
      slider(0, 60, 0.1, p.wait || 0, (v) => (v ? `wait ${v.toFixed(1)} s` : "no wait"), (dd, v) => mod((it) => (it.route[i].wait = v))(dd)),
      h("button", { class: "btn icon ghost", title: "Remove this point", "aria-label": `Remove point ${i + 1}`, disabled: b.route.length <= 2, onclick: () => removePoint(b, i) }, ic("trash"))));
  });
  box.append(h("button", {
    class: "btn small" + (S.addPoint ? " primary" : ""),
    onclick: () => { S.addPoint = !S.addPoint; S.tool = null; renderSide(); draw(); },
  }, ic("plus"), S.addPoint ? "Click the map… (Esc to stop)" : "Add points on the map"));
  return box;
}

// Rank and agent icons (icons/ranks, icons/agents). The name shows on hover.
const rankIcon = (id) => {
  const r = RANKS.find((x) => x[0] === id);
  return id === "off" || !r ? null : h("img", { class: "rank-ic", src: `icons/ranks/${id}.png`, alt: r[1], title: r[1] });
};
const BOT_TINT = { bot: "#c9d1da", "bot-red": "#ff4655", "bot-purple": "#a37bff" };
function agentIcon(id, label) {
  if (BOT_TINT[id]) { const s = ic("still", "bot-ic"); s.style.color = BOT_TINT[id]; return s; }
  return h("img", { class: "agent-ic", src: `icons/agents/${id}.png`, alt: label || id });
}
function agentGrid(list, value, pick, cls = "") {
  return h("div", { class: "agents " + cls }, list.map(([id, label]) => h("button", { class: id === value ? "on" : "", title: label, "aria-label": label, onclick: () => pick(id) }, agentIcon(id, label))));
}
function rankGrid(value, pick) {
  return h("div", { class: "ranks" }, RANKS.map(([id, label]) => h("button", { class: (id === "off" ? "off " : "") + (id === value ? "on" : ""), onclick: () => pick(id), title: label, "aria-label": label }, id === "off" ? "Doesn't shoot" : rankIcon(id))));
}
function lookGrid(value, pick) {
  return agentGrid(LOOKS, value, pick, "looks");
}
function weaponGrid(value, allowNone, pick) {
  const list = allowNone ? [["", "None"], ...WEAPONS] : WEAPONS;
  return h("div", { class: "weapons" }, list.map(([id, label]) => h("button", { class: id === value ? "on" : "", title: label, onclick: () => pick(id) },
    id ? h("img", { src: `/local/equipment-icons/${id === "tourdeforce" ? "tour-de-force" : id}.png`, alt: "" }) : h("span", { style: "height:18px;line-height:18px" }, "—"), label)));
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
    h("p", { class: "help" }, "Dot color follows the mode: white in Dark, black in Light."),
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
      field("Height", freeSlider(.2,40,.1,w.height,metres,(dd,v)=>mod(it=>{it.height=v;})(dd), FREE)),
      field("Depth", freeSlider(.1,40,.1,wallDepth(w),metres,(dd,v)=>mod(it=>{it.depth=v;})(dd), FREE), 'Or drag the arrows in 3D. Type any size in the box.'),
      field("Length", freeSlider(0.5, 200, 0.1, w.length, metres, (dd, v) => mod((it) => (it.length = v))(dd), FREE), "Or drag the end dots on the map."),
      field("Turn", slider(0, 179, 1, w.turn % 180, (v) => `${v}°`, (dd, v) => mod((it) => (it.turn = v))(dd))),
      h("button", { class: "btn small", onclick: () => edit(mod((it) => (it.turn = Math.round(yawDeg(it, S.drill.start)) % 180))) }, "Square to my view")),
    ...(!w.invisible ? surfacePanel(w) : []),
    floorPicker(w, (dd, y) => mod((it) => (it.y = y))(dd)),
    actions(),
  ];
}

const RECENT_SURFACE_COLORS = "studio-recent-surface-colors";
function recentSurfaceColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_SURFACE_COLORS) || "[]");
    if (!Array.isArray(saved)) return [];
    return [...new Set(saved.filter(color => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)).map(color => color.toLowerCase()))].slice(0, 5);
  } catch { return []; }
}
function rememberSurfaceColor(color) {
  const recent = [color, ...recentSurfaceColors().filter(value => value !== color)].slice(0, 5);
  try { localStorage.setItem(RECENT_SURFACE_COLORS, JSON.stringify(recent)); } catch {}
}
function surfaceColorPicker(item, color) {
  const key = "surface-color-" + item.id;
  const output = h("output", {}, color.toUpperCase());
  const apply = (value, quiet = false) => {
    edit(mod(it => { it.surfaceColor = value; }), { key, quiet });
  };
  const input = h("input", {
    type: "color", value: color, "aria-label": "Object color",
    oninput: event => {
      const value = event.target.value.toLowerCase();
      output.textContent = value.toUpperCase();
      apply(value, true);
    },
    onchange: event => {
      const value = event.target.value.toLowerCase();
      rememberSurfaceColor(value);
      // Color inputs emit input before change; refresh without adding another undo entry.
      renderSide();
    },
  });
  const recent = recentSurfaceColors();
  return h("div", { class: "surface-colors" },
    h("div", { class: "surface-color-picker" }, input, output,
      h("button", { type: "button", class: "btn small", onclick: () => edit(mod(it => { delete it.surfaceColor; })) }, "Use theme")),
    recent.length ? h("div", { class: "surface-recent-colors", role: "group", "aria-label": "Five last used colors" },
      recent.map(value => h("button", {
        type: "button", class: "surface-color-swatch", style: "--swatch:" + value,
        title: value.toUpperCase(), "aria-label": "Use color " + value.toUpperCase(),
        onclick: () => { rememberSurfaceColor(value); apply(value); },
      }))) : null);
}

// arena-colors-v1: one row per arena part (swatch, name, color); "Reset" goes back to the Dark / Light color.
function arenaColorsField(d) {
  const row = ([k, label]) => {
    const custom = customArenaColor(d, k), color = arenaColor(d, k);
    const value = h("span", { class: "arena-color-value" }, custom ? color.toUpperCase() : "Mode color");
    const set = (v, quiet) => edit(dd => { dd.arenaColors = { ...(dd.arenaColors || {}), [k]: v }; }, { key: "arena-color-" + k, quiet });
    return h("label", { class: "arena-color-row" + (custom ? " custom" : "") },
      h("input", { type: "color", value: color, "aria-label": label + " color",
        oninput: e => { const v = e.target.value.toLowerCase(); value.textContent = v.toUpperCase(); set(v, true); },
        onchange: e => { rememberSurfaceColor(e.target.value.toLowerCase()); renderSide(); } }),
      h("span", { class: "arena-color-name" }, label, value),
      custom ? h("button", { type: "button", class: "btn small", title: "Back to the " + (darkArena(d) ? "Dark" : "Light") + " mode color",
        onclick: e => { e.preventDefault(); edit(dd => { const c = { ...(dd.arenaColors || {}) }; delete c[k]; dd.arenaColors = c; }); renderSide(); } }, "Reset") : null);
  };
  const any = ARENA_COLOR_KEYS.some(([k]) => customArenaColor(d, k));
  return h("div", { class: "field" },
    h("label", {}, "Colors"),
    h("div", { class: "arena-colors" }, ...ARENA_COLOR_KEYS.map(row)),
    h("div", { class: "arena-colors-foot" },
      h("p", { class: "help" }, "Click a swatch to pick a color. Pieces you colored yourself keep their color."),
      any ? h("button", { type: "button", class: "btn small", onclick: () => { edit(dd => { delete dd.arenaColors; }); renderSide(); } }, "Reset all") : null));
}

function surfacePanel(item) {
  const appearance = surfaceFor(S.drill, item, item.shape === 'floor');
  return [h("div", { class: "group" },
    field("Surface", seg(SURFACES, appearance.surfaceStyle?.startsWith('industrial') ? 'industrial' : appearance.surface ? 'tile' : 'plain', v => edit(mod(it => { it.surface = v; })))),
    field("Color", surfaceColorPicker(item, appearance.color), "Choose any color. Your five last used colors are saved here."))];
}

function blockPanel(b) {
  const s = BLOCK_SHAPES[b.shape];
  const num = (key, min, max, step, label, help) => field(label, freeSlider(min, max, step, b[key], metres, (dd, v) => mod((it) => (it[key] = v))(dd), key === "lift" ? { hardMin: 0, hardMax: MAX_SIZE } : FREE), help);
  const turnBy = (deg) => edit(mod((it) => (it.turn = (((it.turn || 0) + deg) % 360 + 360) % 360)));
  return [
    ...head(b.invisible ? "airfloor" : `b-${b.shape}`, b.invisible ? "ic-air" : "ic-gear", itemName(S.drill, b), b.invisible
      ? "You and the bots stand on it, but nobody can see it, and bullets go through it. Use it to walk in the air or past the edge of the arena."
      : s.tip),
    // studio-air-floor: a floor can be solid or invisible.
    b.shape === "floor" ? h("div", { class: "group" }, field("Type", seg([[false, "Solid floor"], [true, "Invisible floor"]], !!b.invisible, (v) => edit(mod((it) => { if (v) it.invisible = true; else delete it.invisible; }))))) : null,
    b.invisible ? null : h("div", { class: "group" },
      field("Piece", seg(Object.entries(BLOCK_SHAPES).map(([k, v]) => [k, v.label]), b.shape, (v) => edit(mod((it) => {
        const n = BLOCK_SHAPES[v];
        Object.assign(it, { shape: v, w: n.w, d: n.d, h: n.h, lift: n.lift });
      }))))),
    h("div", { class: "group" },
      b.shape === "pillar"
        ? num("w", 0.3, 4, 0.1, "Thickness")
        : num("w", 0.5, 40, 0.1, b.shape === "window" || b.shape === "door" ? "Length" : "Width"),
      b.shape === "pillar" ? null : num("d", 0.1, 40, 0.1, b.shape === "ramp" || b.shape === "stairs" ? "Length (up the slope)" : "Depth"),
      num("h", b.shape === "floor" ? 0.1 : 0.3, 40, 0.1, b.shape === "ramp" || b.shape === "stairs" ? "How high it goes" : b.shape === "floor" ? "Thickness" : "Height"),
      b.shape === "floor" || b.shape === "box" ? num("lift", 0, 12, 0.1, "Raised off the floor", b.shape === "floor" ? "Match a ramp's or stairs' height so you can walk up onto it." : "0 sits on the floor.") : null,
      b.shape === "room" ? field("Open side", seg([["front", "Front"], ["back", "Back"], ["left", "Left"], ["right", "Right"], ["none", "None"]], b.open || "front", (v) => edit(mod((it) => (it.open = v))))) : null),
    h("div", { class: "group" },
      field("Turn", slider(0, 359, 1, b.turn || 0, (v) => `${v}°`, (dd, v) => mod((it) => (it.turn = v))(dd)),
        b.shape === "ramp" || b.shape === "stairs" ? "The white arrow on the map points up the slope." : null),
      h("div", { class: "danger-zone" },
        h("button", { class: "btn small", onclick: () => turnBy(-90) }, "↺ 90°"),
        h("button", { class: "btn small", onclick: () => turnBy(90) }, "↻ 90°"),
        h("button", { class: "btn small", onclick: () => edit(mod((it) => (it.turn = Math.round((yawDeg(it, S.drill.start) + 180) % 360)))) }, "Face me"))),
    ...(b.invisible ? [] : surfacePanel(b)),
    floorPicker(b, (dd, y) => mod((it) => (it.y = y))(dd)),
    actions(),
  ];
}

// studio-arena-rect: Width (left-right) and Depth (front-back), each resized around the arena's middle.
function arenaSideFields(d) {
  const r = arenaRect(d), max = 2 * ARENA_REACH;
  const side = (axis, label, help) => {
    const size = Math.round((r[axis + "1"] - r[axis + "0"]) * 100) / 100;
    return field(label, freeSlider(ARENA_MIN, max, 0.5, size, metres, (dd, v) => {
      const q = arenaRect(dd), mid = (q[axis + "0"] + q[axis + "1"]) / 2;
      q[axis + "0"] = mid - v / 2; q[axis + "1"] = mid + v / 2;
      delete dd.arenaSize; setArenaRect(dd, q);
    }, { hardMin: ARENA_MIN, hardMax: max }), help);
  };
  return [side("x", "Width", "Left to right. Or drag the arrows on the edges in 2D (Alt: free)."), side("z", "Depth", "Front to back.")];
}
// A slider plus a number box. The slider covers the usual range; the box takes any value between
// hardMin and hardMax (studio-free-size: pieces are not limited to what the slider shows).
function freeSlider(min, max, step, value, fmt, set, { hardMin = min, hardMax = 1000 } = {}) {
  const key = `slider-${Math.random()}`;
  const clamp = (v) => Math.max(hardMin, Math.min(hardMax, v));
  const box = h("input", {
    type: "number", class: "num", min: hardMin, max: hardMax, step, value: Math.round(value * 100) / 100,
    onchange: (e) => { const v = +e.target.value; if (Number.isFinite(v)) edit((d) => set(d, clamp(v))); renderSide(); },
    onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); e.stopPropagation(); },
  });
  const input = h("input", {
    type: "range", min, max: Math.max(max, value), step, value,
    oninput: (e) => { const v = +e.target.value; box.value = v; edit((d) => set(d, v), { key, quiet: true }); },
    onchange: () => renderSide(),
  });
  return h("div", { class: "slider free" }, input, box, h("output", {}, fmt(value).replace(/[\d.,\s×]+/g, "").trim() || ""));
}

function smokePanel(s) {
  return [
    ...head("smoke", "ic-gear", itemName(S.drill, s), "A smoke that blocks sight (not bullets)."),
    h("div", { class: "group" },
      field("Whose smoke", agentGrid(SMOKE_AGENTS, s.agent, (v) => edit(mod((it) => (it.agent = v))))),
      field("Pops at", stopSlider(SMOKE_STOPS, s.at || 0, clock, (dd, v) => mod((it) => (it.at = v))(dd)), "Time after the round starts, up to 30 min (fine steps in the first minute)."),
      field("Height off the floor", slider(0, 30, 0.1, s.height || 0, (v) => (v ? `${v.toFixed(1)} m` : "On the floor"), (dd, v) => mod((it) => (it.height = v))(dd)),
        `Raise it for a one-way: you see feet under it and they can't see you. The ball is ${(smokeSpec(s).radius * 2).toFixed(1)} m across. In 3D, drag the white dot on top up or down.`),
      field("Lasts", stopSlider(SMOKE_STOPS, s.life || 0, (v) => (v ? clock(v) : `Game (${smokeSpec(s).life} s)`), (dd, v) => mod((it) => (it.life = v))(dd)),
        "How long it stays full before it fades, up to 30 min. Far left: as long as that agent's smoke in the game.")),
    floorPicker(s, (dd, y) => mod((it) => (it.y = y))(dd)),
    actions(),
  ];
}

// Panel for several things selected together.
function groupPanel() {
  const items = groupItems();
  return [
    ...head("copy", "ic-gear", `${items.length} selected`, "Drag any of them to move them all together (bots bring their routes, spots, trigger lines and flash targets)."),
    h("div", { class: "group" },
      field("Selected", h("div", {}, ...items.map((i) => h("div", { class: "btn-row" },
        h("button", { class: "btn small", title: "Select just this one", onclick: () => { setGroup([i.id]); renderSide(); draw(); } }, itemName(S.drill, i)),
        h("button", { class: "btn small", title: "Take it out of the selection", "aria-label": `Take ${itemName(S.drill, i)} out of the selection`, onclick: () => toggleInGroup(i.id) }, ic("minus")))))),
      h("p", { class: "help" }, "Shift-click a thing to add it or take it out · Shift-drag on empty map to box-select (2D) · Esc to clear · Backspace/Del deletes them all · Ctrl+D copies them.")),
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

// /studio/?probe: lets the placement check (previews/studio-placement) read the editor. Not used by the app.
if (new URLSearchParams(location.search).has("probe")) window.__studioProbe = { get S() { return S; }, get view() { return view3d; }, standOn, floorAt, edit, newBot, select: (id) => { S.sel = id; renderSide(); draw(); },
  // drag3d-points-v1: build + draw the 3D view now (tests run where the page gets no animation frames)
  paint3d: () => { if (view3d && S.mode3d) paint3d(performance.now()); } };

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
  let draft;
  try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch {}
  if (draft?.drill && Array.isArray(draft.drill.items) && draft.drill.round && typeof draft.drill.place === 'string') {
    await openDrill(draft.drill);
    S.saved = typeof draft.saved === 'string' ? draft.saved : '';
    S.sel = draft.sel === 'start' || S.drill.items.some(i => i.id === draft.sel) ? draft.sel : null;
    renderSide(); updateTop(); draw(); rememberEditor();
    await takeRecording();
    return;
  }
  showLibrary();
})();
