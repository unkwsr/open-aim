// The Studio's drill format and how it becomes a game scene.
//
// A drill is what the Studio edits: a place (the training range or a map), where you
// stand, the round rules and a list of things on the map (bots, target zones, walls,
// smokes). compile() turns it into the scene file the game plays (schemaVersion 2).

import { arenaSize, arenaBlocks, surfaceFor, darkArena, targetColor } from './arena.js';
import { wallDepth } from './transform.js';
import { strafeSettings } from './strafe.js';

export const MAPS = [
  ["ascent", "Ascent"], ["bonsai", "Split"], ["triad", "Haven"], ["plummet", "Summit"],
  ["jam", "Lotus"], ["infinity", "Abyss"], ["rook", "Corrode"], ["duality", "Bind"],
  ["juliett", "Sunset"],
];
export const mapLabel = (id) => (MAPS.find((m) => m[0] === id) || [id, id])[1];

export const WEAPONS = [
  ["classic", "Classic"], ["shorty", "Shorty"], ["frenzy", "Frenzy"], ["ghost", "Ghost"], ["sheriff", "Sheriff"],
  ["stinger", "Stinger"], ["spectre", "Spectre"], ["bucky", "Bucky"], ["judge", "Judge"],
  ["bulldog", "Bulldog"], ["guardian", "Guardian"], ["phantom", "Phantom"], ["vandal", "Vandal"],
  ["marshal", "Marshal"], ["outlaw", "Outlaw"], ["operator", "Operator"], ["ares", "Ares"], ["odin", "Odin"],
];
export const weaponLabel = (id) => (WEAPONS.find((w) => w[0] === id) || [id, id])[1];

// "phoenix" is the game's default look (no look set on the bot).
export const LOOKS = [
  ["phoenix", "Phoenix"], ["bot", "Training bot"], ["bot-red", "Red bot"], ["bot-purple", "Purple bot"],
  ...["astra", "breach", "brimstone", "chamber", "clove", "cypher", "deadlock", "fade", "gekko", "harbor", "iso", "jett", "kayo",
    "killjoy", "miks", "neon", "omen", "raze", "reyna", "sage", "skye", "sova", "tejo", "veto", "viper", "vyse", "waylay", "yoru"]
    .map((id) => [id, id === "kayo" ? "KAY/O" : id[0].toUpperCase() + id.slice(1)]),
];

// Flashes a bot can throw: [agent, name, what it does, curve choices or null].
export const FLASH_AGENTS = [
  ["phoenix", "Phoenix", "Curveball: bends around the corner and pops in front of you.", [["right", "Curves right"], ["left", "Curves left"]]],
  ["kayo", "KAY/O", "FLASH/drive: a lobbed grenade that pops in the air.", null],
  ["reyna", "Reyna", "Leer: an eye that blinds you while you look at it.", null],
  ["breach", "Breach", "Flashpoint: goes through the wall and pops on your side.", null],
  ["skye", "Skye", "Guiding Light: a hawk flies out and pops.", [["straight", "Flies straight"], ["left", "Swings left"], ["right", "Swings right"]]],
  ["yoru", "Yoru", "Blindside: bounces off a wall, then pops.", null],
];
export const FLASH_FUSE = 0.7; // seconds from throw to pop (preview)

export const SMOKE_AGENTS =[["brimstone", "Brimstone"], ["omen", "Omen"], ["astra", "Astra"], ["clove", "Clove"], ["miks", "Miks"], ["jett", "Jett"]];

// How well a bot shoots back. reaction: seconds from seeing you to the first shot;
// error: aim error in degrees; heads: whether it aims at your head (hard) or body/legs.
export const RANKS = [
  ["off", "Doesn't shoot", null],
  ["iron", "Iron", { reaction: [0.9, 1.1], error: 9, heads: false }],
  ["bronze", "Bronze", { reaction: [0.75, 0.9], error: 7, heads: false }],
  ["silver", "Silver", { reaction: [0.6, 0.75], error: 5.5, heads: false }],
  ["gold", "Gold", { reaction: [0.5, 0.62], error: 4.5, heads: false }],
  ["platinum", "Platinum", { reaction: [0.42, 0.52], error: 3.5, heads: true }],
  ["diamond", "Diamond", { reaction: [0.34, 0.44], error: 2.8, heads: true }],
  ["ascendant", "Ascendant", { reaction: [0.28, 0.36], error: 2.2, heads: true }],
  ["immortal", "Immortal", { reaction: [0.22, 0.3], error: 1.6, heads: true }],
  ["radiant", "Radiant", { reaction: [0.17, 0.23], error: 1.1, heads: true }],
];

// What a bot does. Each one is a card in the "Add" tray.
export const MOVES = {
  still: { label: "Stands still", short: "Holder", tip: "Stands on its spot and holds the angle." },
  strafe: { label: "Strafes left and right", short: "Strafer", tip: "A-D strafes on its spot, stopping at each end like a real player." },
  peek: { label: "Peeks out, then hides", short: "Peeker", tip: "Swings out from cover, A-D strafes at the peek spot, then goes back behind cover. Again and again." },
  cross: { label: "Runs across", short: "Runner", tip: "Runs from one point to another and disappears, then comes again." },
  patrol: { label: "Walks a route", short: "Rusher", tip: "Walks along a route you draw, stopping where you want." },
  copycat: { label: "Copies your recorded run", short: "Copycat", tip: "Record yourself moving from its spot (strafes, stops, crouches, jumps); it repeats that run and shoots at you." },
};

// Copycat recordings: the longest run you can record, and how many samples a second are kept.
export const RECORD_SECONDS = 30;
export const TRACK_HZ = 30;
export const PLAYBACKS = [["loop", "Loop"], ["once", "Once, then stand"], ["pingpong", "Back and forth"]];

export const SPEEDS = { walk: 2.97, run: 5.4 };
export const ARMOR = [[100, "No armor (100)"], [125, "Light armor (125)"], [150, "Heavy armor (150)"]];
export const TARGET_SIZES = { small: 0.12, medium: 0.2, large: 0.32 };

// Bumped whenever compile() changes what it writes; the Studio re-saves older drills.
export const COMPILER = 15;
export const DEFAULT_JUMP_HEIGHT = 1.15;

let counter = 0;
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function newDrill(place = "range") {
  return {
    v: 1,
    name: "My drill",
    note: "",
    place,
    rangeSize: "medium",
    arenaTheme: "charcoal",
    start: { x: 0, y: 0, z: 8, facing: 0 },
    round: { goal: "score", time: 60, par: 0, weapon: "vandal", auto: true, move: false, die: false, ammo: false, order: "together", atOnce: 1, gap: 1 },
    items: [],
  };
}

export function newBot(move, at) {
  const bot = {
    id: newId("bot"), kind: "bot", move, x: at.x, y: at.y, z: at.z,
    look: "phoenix", weapon: "", crouch: false, shoots: "off", hp: 150, back: true, backAfter: 1.5,
    speed: "run", width: 3, wait: 1.2, delay: 0, peekStrafe: true, coverWait: 1, unpredictable: false,
    hitSlow: false, jump: false, jumpHeight: DEFAULT_JUMP_HEIGHT, jumpMin: 1.5, jumpMax: 3,
    crouchRandom: false, crouchMin: 0.5, crouchMax: 1.2, crouchGapMin: 2, crouchGapMax: 4,
    facing: null, // null: turns to face you; a number: always faces that way (game yaw, degrees)
    flash: { on: false, agent: "phoenix", curve: "right", wait: 1, height: 2.2, at: 1, target: null },
  };
  if (move === "peek") bot.route = [{ x: at.x - 2, y: at.y, z: at.z, wait: 0 }, { x: at.x, y: at.y, z: at.z, wait: 1.2 }];
  if (move === "cross") bot.route = [{ x: at.x - 4, y: at.y, z: at.z, wait: 0 }, { x: at.x + 4, y: at.y, z: at.z, wait: 0 }];
  if (move === "patrol") bot.route = [{ x: at.x, y: at.y, z: at.z, wait: 0 }, { x: at.x, y: at.y, z: at.z + 5, wait: 1 }];
  if (move === "peek" || move === "cross" || move === "patrol") Object.assign(bot, { x: bot.route[0].x, y: bot.route[0].y, z: bot.route[0].z });
  // track: the recorded run (see trackFromTake), null until you record one.
  // fireWhen "mine": shoots only in the moments you fired while recording, without stopping;
  // "sees": stops and shoots as soon as it sees you, like the other bots.
  Object.assign(bot, { track: null, playback: "loop", replaySpeed: 1, mirror: false, randomStart: false, fireWhen: "mine" });
  if (move === "copycat") bot.shoots = "gold";
  return bot;
}

// Fills in settings added after a drill was saved, so older drills open with every option.
export function normalize(drill) {
  // Older dark presets used Plain to hide a heavy tile pattern. Replace their
  // bright helper overlay once; newly chosen Plain remains genuinely plain.
  if ((drill.compiled || 0) < 6 && drill.arenaTheme !== 'original' && drill.floorSurface === 'plain') drill.floorSurface = 'tile';
  // Retain old flat/grid choices, collapse decorative surfaces to the grid,
  // and let the chosen mode supply all building colors.
  if (drill.arenaTheme === 'original') {
    drill.floorSurface ||= 'plain'; drill.wallSurface ||= 'plain';
  }
  drill.arenaTheme = darkArena(drill) ? 'charcoal' : 'light';
  for (const key of ['floorSurface', 'wallSurface']) if (drill[key] === 'stone') drill[key] = 'tile';
  for (const item of drill.items) if (item.kind === 'wall' || item.kind === 'block') {
    if (item.surface === 'stone') item.surface = 'tile';
    delete item.surfaceColor;
  }
  for (const it of drill.items) {
    if (it.kind !== "bot") continue;
    const fresh = newBot(it.move, it);
    for (const k of ["peekStrafe", "coverWait", "flash", "unpredictable", "hitSlow", "jump", "jumpHeight", "jumpMin", "jumpMax", "crouchRandom", "crouchMin", "crouchMax", "crouchGapMin", "crouchGapMax",
      "track", "playback", "replaySpeed", "mirror", "randomStart", "fireWhen"]) if (it[k] === undefined) it[k] = fresh[k];
  }
  return drill;
}

export const newTargets = (at) => ({
  id: newId("tz"), kind: "targets", x: at.x, y: at.y, z: at.z, lift: 1.6, width: 6, height: 2.5,
  count: 1, size: "medium", vanish: 0, motion: "still", color: "#2fe0c8",
});
export const newWall = (at) => ({ id: newId("wall"), kind: "wall", x: at.x, y: at.y, z: at.z, length: 4, height: 2, turn: 0 });
// Invisible wall: blocks walking (you and bots) but not sight or bullets.
export const newBarrier = (at) => ({ ...newWall(at), id: newId("air"), invisible: true, length: 6, height: 4 });

// ---------- structures you build (Build tray) ----------
// w: width (left-right), d: depth (front-back), h: height, lift: how far the bottom is above
// the floor it stands on, turn: degrees. Ramps and stairs go up toward their front (+d side).
export const BLOCK_SHAPES = {
  box: { label: "Box", tip: "A crate or block to stand on or hide behind.", w: 2, d: 2, h: 1.2, lift: 0, color: "#8a7356" },
  floor: { label: "Floor", tip: "A flat platform, raised off the ground. Climb it with a ramp or stairs.", w: 6, d: 6, h: 0.3, lift: 2, color: "#6b7280" },
  ramp: { label: "Ramp", tip: "A slope up to a higher floor.", w: 3, d: 6, h: 2.3, lift: 0, color: "#7a8190" },
  stairs: { label: "Stairs", tip: "Steps up to a higher floor.", w: 2.5, d: 5, h: 2.3, lift: 0, color: "#7a8190" },
  window: { label: "Window wall", tip: "A wall with a window to shoot through.", w: 4, d: 0.3, h: 3, lift: 0, color: "#59606b" },
  door: { label: "Door wall", tip: "A wall with a doorway to walk through.", w: 4, d: 0.3, h: 3, lift: 0, color: "#59606b" },
  pillar: { label: "Pillar", tip: "A round column.", w: 1, d: 1, h: 3, lift: 0, color: "#9aa1ae" },
  room: { label: "Room", tip: "Four walls, floor and roof; one side left open.", w: 6, d: 6, h: 3, lift: 0, color: "#59606b" },
};
export const BLOCK_COLORS = [["#6b7280", "Concrete"], ["#3a4049", "Dark"], ["#8a7356", "Wood"], ["#b9a27a", "Sand"], ["#9aa1ae", "Light"], ["#7a2f36", "Red"], ["#2b6f68", "Teal"]];

export function newBlock(shape, at) {
  const s = BLOCK_SHAPES[shape];
  return { id: newId("blk"), kind: "block", shape, x: at.x, y: at.y, z: at.z, w: s.w, d: s.d, h: s.h, lift: s.lift, turn: 0, color: s.color, open: "front" };
}

const OPEN_FACE = { front: "pz", back: "nz", left: "nx", right: "px" };

// The game block for a structure (center position, size, rotation, shape details).
export function gameBlock(b, id, baseY) {
  const shape = { box: "box", floor: "box", ramp: "ramp", stairs: "stairs", window: "opening", door: "opening", pillar: "cylinder", room: "hollow" }[b.shape];
  const w = Math.max(0.2, b.w), h = Math.max(0.1, b.h), d = Math.max(0.1, b.d);
  const block = {
    id, shape, position: pos(b.x, baseY + (b.lift || 0) + h / 2, b.z), rotationY: r2(rad(b.turn || 0)),
    size: pos(b.shape === "pillar" ? w : w, h, b.shape === "pillar" ? w : d), color: b.color || "#6b7280", collidable: true,
  };
  if (b.shape === "stairs") block.steps = Math.max(2, Math.min(40, Math.round(h / 0.25)));
  // Window: about chest to head height (bottom ~1 m above the floor).
  if (b.shape === "window") block.hole = { width: r2(Math.min(3, w * 0.8)), height: r2(Math.min(1.2, h * 0.45)), offsetX: 0, offsetY: r2(Math.min(1.6, h * 0.55) - h / 2) };
  if (b.shape === "door") { const dh = Math.min(2.2, h * 0.9); block.hole = { width: r2(Math.min(1.4, w * 0.8)), height: r2(dh), offsetX: 0, offsetY: r2(dh / 2 - h / 2) }; }
  if (b.shape === "room") { block.thickness = 0.3; if (b.open && b.open !== "none") block.openFaces = [OPEN_FACE[b.open]]; }
  return block;
}

// Heights you can stand on at (x, z) on top of structures (excluding `skipId`).
export function structureTops(items, x, z, skipId) {
  const tops = [];
  for (const b of items) {
    if (b.kind !== "block" || b.id === skipId || b.shape === "window" || b.shape === "door" || b.shape === "room") continue;
    const a = rad(b.turn || 0), c = Math.cos(a), s = Math.sin(a);
    const dx = x - b.x, dz = z - b.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const bottom = (b.y || 0) + (b.lift || 0);
    if (b.shape === "pillar") { if (Math.hypot(lx, lz) <= b.w / 2) tops.push(bottom + b.h); continue; }
    if (Math.abs(lx) > b.w / 2 || Math.abs(lz) > b.d / 2) continue;
    const f = lz / b.d + 0.5; // 0 at the low (back) end, 1 at the high (front) end
    if (b.shape === "ramp") tops.push(bottom + b.h * f);
    else if (b.shape === "stairs") { const n = Math.max(2, Math.round(b.h / 0.25)); tops.push(bottom + (b.h * Math.min(n, Math.ceil(f * n))) / n); }
    else tops.push(bottom + b.h);
  }
  return tops.map((y) => Math.round(y * 100) / 100);
}
export const newSmoke = (at) => ({ id: newId("smoke"), kind: "smoke", x: at.x, y: at.y, z: at.z, agent: "omen", at: 0 });

export const itemName = (drill, item) => {
  const same = drill.items.filter((i) => (i.kind === "bot" ? i.kind === item.kind && i.move === item.move
    : i.kind === "block" ? i.kind === item.kind && i.shape === item.shape
    : i.kind === item.kind && !!i.invisible === !!item.invisible));
  const n = same.indexOf(item) + 1;
  if (item.kind === "bot") return `${MOVES[item.move].short} ${n}`;
  if (item.kind === "block") return `${BLOCK_SHAPES[item.shape].label} ${n}`;
  if (item.invisible) return `Invisible wall ${n}`;
  return `${{ targets: "Targets", wall: "Wall", smoke: "Smoke" }[item.kind]} ${n}`;
};

// ---------- checks, in plain words ----------

export function problems(drill, floorAt) {
  const out = [];
  const shootables = drill.items.filter((i) => i.kind === "bot" || i.kind === "targets");
  if (!shootables.length) out.push({ text: "Add at least one bot or target to shoot." });
  for (const item of drill.items) {
    const name = itemName(drill, item);
    if (item.kind === "bot" && item.route && item.route.length < 2) out.push({ id: item.id, text: `${name} needs at least 2 route points.` });
    if (item.kind === "bot" && item.move === "copycat") {
      if (!item.track) out.push({ id: item.id, text: `${name} has no run yet. Select it and press "Record my movement".` });
      else if (trackBlocked(drill, item)) out.push({ id: item.id, text: `${name}'s run goes through a wall or box. Move it or record again.`, soft: true });
    }
    if (floorAt && floorAt(item.x, item.z) === null) out.push({ id: item.id, text: `${name} is off the floor. Drag it onto the floor.` });
    if (floorAt && item.route) item.route.forEach((p, i) => {
      if (i > 0 && floorAt(p.x, p.z) === null) out.push({ id: item.id, text: `${name}: route point ${i + 1} is off the floor.` });
    });
  }
  if (floorAt && floorAt(drill.start.x, drill.start.z) === null) out.push({ id: "start", text: "Your start spot is off the floor." });
  if (drill.items.filter((i) => i.kind === "smoke").length > 8) out.push({ text: "Use at most 8 smokes." });
  if (drill.round.goal === "track" && !drill.items.some((i) => (i.kind === "bot" && i.move !== "still") || (i.kind === "targets" && i.motion !== "still"))) {
    out.push({ text: "Tracking needs something that moves: add a strafer, runner or moving targets.", soft: true });
  }
  if (drill.round.goal === "clear" && drill.items.some((i) => i.kind === "bot" && i.move === "patrol" && i.back)) {
    out.push({ text: "In \"Clear them all\", bots don't come back after a kill.", soft: true });
  }
  return out;
}

// ---------- compile to a game scene ----------

const r2 = (n) => Math.round(n * 1000) / 1000;
const rad = (deg) => (deg * Math.PI) / 180;
const pos = (x, y, z) => ({ x: r2(x), y: r2(y), z: r2(z) });
// Game yaw for "looking from a toward b": yaw 0 looks down -z, positive turns left.
const yawTo = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));


function shooter(rank) {
  const r = (RANKS.find((x) => x[0] === rank) || RANKS[0])[2];
  if (!r) return null;
  return {
    kind: "shooter", difficulty: r.heads ? "hard" : "easy", reaction: [...r.reaction], cadence: "weapon",
    aimErrorDeg: r.error, maxRangeM: 80, engage: "stop", resumeDelay: [0.4, 0.8],
  };
}

function humanoid(bot) {
  const body = { shape: "humanoid", headSize: 1, bodyWidth: 0.44, bodyHeight: 0 };
  if (bot.look && bot.look !== "phoenix") body.look = bot.look;
  if (bot.crouch && !bot.crouchRandom && bot.move !== "copycat") body.motion = "crouch";
  if (bot.weapon) Object.assign(body, { weapon: bot.weapon, dropWeapon: true });
  return body;
}

// Side-to-side direction (unit x/z) for something at `p` facing `start`.
export function acrossFrom(p, start) {
  const dx = start.x - p.x, dz = start.z - p.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: -dz / len, z: dx / len };
}
const toward = (p, start, m) => {
  const dx = start.x - p.x, dz = start.z - p.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: p.x + (dx / len) * m, z: p.z + (dz / len) * m };
};

const PEEK_JIGGLE = [0.7, -0.5, 0.6]; // A-D steps around the peek spot, in metres
const JIGGLE_WAIT = 0.15;

// Where a bot with a route goes, in order: points with how long it stays at each, whether it
// loops back to the first point (never disappears) or disappears at the last one, and which
// point it throws its flash from. compile() and the Studio's preview both use this, so the
// preview moves exactly like the game.
// once: bots take turns (one at a time), so a peeker peeks once and hides for good.
export function plan(bot, start, once = false) {
  if (!bot.route || bot.route.length < 2) return null;
  const flash = !!(bot.flash && bot.flash.on);
  if (bot.move === "peek") {
    const [cover, spot] = bot.route;
    const a = acrossFrom(spot, start);
    const vanish = flash || once;
    const pts = [{ ...cover, wait: vanish ? 0 : bot.coverWait ?? 1 }];
    // A flashing peeker stops at the edge of its cover, throws, then swings.
    if (flash) pts.push({ x: cover.x + (spot.x - cover.x) * 0.2, y: cover.y, z: cover.z + (spot.z - cover.z) * 0.2, wait: 0 });
    const jig = bot.peekStrafe ? PEEK_JIGGLE : [];
    pts.push({ ...spot, wait: Math.max(0.1, bot.wait - jig.length * JIGGLE_WAIT) });
    for (const s of jig) pts.push({ x: spot.x + a.x * s, y: spot.y, z: spot.z + a.z * s, wait: JIGGLE_WAIT });
    if (vanish) pts.push({ ...cover, wait: 0 });
    return { pts, loop: !vanish, flashAt: flash ? 1 : -1, hidden: bot.coverWait ?? 1 };
  }
  const pts = bot.route.map((p) => ({ ...p, wait: p.wait || 0 }));
  const flashAt = flash ? Math.max(1, Math.min(pts.length - 1, bot.flash.at || 1)) : -1;
  if (flashAt > 0) pts[flashAt] = { ...pts[flashAt], wait: 0 };
  return { pts, loop: bot.move === "patrol" && !flash, flashAt, hidden: bot.backAfter };
}

// Where the flash pops (x, z): the one set on the map, or a spot in front of the thrower.
export function flashTarget(bot, start) {
  if (bot.flash && bot.flash.target) return bot.flash.target;
  const p = plan(bot, start);
  if (!p || p.flashAt < 0) return null;
  const from = bot.move === "peek" ? bot.route[1] : p.pts[p.flashAt];
  return toward(from, start, bot.move === "peek" ? 2.5 : 4);
}

// ---------- copycat runs ----------
// A run is kept around the bot's spot, turned so "toward" points from the bot to your start
// spot; moving or turning the bot (or your start) takes the whole run with it.
// track: { hz, secs, p: [side, up, toward, crouch, fired, in the air, ...] }, hz samples a second.
const TRACK_STRIDE = 6;
const round2 = (n) => Math.round(n * 100) / 100;

function trackAxes(bot, start) {
  const dx = start.x - bot.x, dz = start.z - bot.z, len = Math.hypot(dx, dz) || 1;
  const toward = { x: dx / len, z: dz / len };
  return { toward, side: { x: -toward.z, z: toward.x } };
}

// The scene for recording a copycat's run: you start on the bot's spot, facing your usual
// start spot, where a still bot stands to aim at. Walls and buildings stay; other bots don't.
export function recordingDrill(drill, bot) {
  const d = JSON.parse(JSON.stringify(drill));
  d.name = `Recording: ${itemName(drill, bot)}`;
  d.items = d.items.filter((i) => i.kind === "wall" || i.kind === "block");
  d.items.push(Object.assign(newBot("still", drill.start), { look: "bot", shoots: "off", back: true, backAfter: 0.5 }));
  d.start = { x: bot.x, y: bot.y, z: bot.z, facing: (yawTo(bot, drill.start) * 180) / Math.PI };
  d.round = { ...d.round, goal: "score", time: RECORD_SECONDS, move: true, die: false, ammo: false, order: "together", par: 0 };
  return d;
}
export function compileRecording(drill, bot, floorAt) {
  const { doc } = compile(recordingDrill(drill, bot), floorAt);
  doc.rules.studioRecord = true; // the game keeps your movement (studio-replay-record)
  return doc;
}

// take: what the game kept while recording (globalThis.__aimStudioTake):
// ticks[tick] = [x, y, z, crouch, firing, in the air], dt seconds apart. The first tick is
// the bot's spot. Standing still before the first move is cut to a quarter second.
export function trackFromTake(take, bot, start) {
  if (!take || !Array.isArray(take.ticks) || !(take.dt > 0)) return null;
  const ticks = take.ticks.slice(0, (take.last || take.ticks.length - 1) + 1).filter(Array.isArray);
  if (ticks.length < 2) return null;
  const dt = take.dt, o = ticks[0];
  let first = ticks.findIndex((k) => Math.hypot(k[0] - o[0], k[2] - o[2]) > 0.02 || k[3] > 0 || k[4] || k[5]);
  if (first < 0) return null; // never moved
  first = Math.max(0, first - Math.round(0.25 / dt));
  const used = ticks.slice(first, first + Math.round(RECORD_SECONDS / dt) + 1);
  const { toward, side } = trackAxes(bot, start);
  const n = Math.floor((used.length - 1) * dt * TRACK_HZ) + 1, last = used.length - 1, p = [];
  // A shot counts for a little while around it, so a copycat that fires "when I shot"
  // still gets its own reaction time to find you.
  const window = Math.round(0.12 / dt);
  for (let j = 0; j < n; j++) {
    const k = j / TRACK_HZ / dt, a = Math.min(last, Math.floor(k)), b = Math.min(last, a + 1), w = k - a;
    const at = (i) => used[a][i] + (used[b][i] - used[a][i]) * w;
    const dx = at(0) - o[0], dz = at(2) - o[2];
    let fired = 0;
    for (let i = Math.max(0, a - window); i <= Math.min(last, b + window); i++) if (used[i][4]) { fired = 1; break; }
    p.push(round2(dx * side.x + dz * side.z), round2(at(1) - o[1]), round2(dx * toward.x + dz * toward.z), round2(at(3)), fired, used[Math.min(last, Math.round(k))][5] ? 1 : 0);
  }
  return { hz: TRACK_HZ, secs: round2((n - 1) / TRACK_HZ), p };
}

// The run in world positions, as the game plays it: [x, y, z, crouch, fired, in the air, ...].
export function copycatFrames(bot, start) {
  const t = bot.track;
  if (!t || !Array.isArray(t.p) || t.p.length < TRACK_STRIDE) return null;
  const { toward, side } = trackAxes(bot, start), flip = bot.mirror ? -1 : 1, out = [];
  for (let i = 0; i + TRACK_STRIDE <= t.p.length; i += TRACK_STRIDE) {
    const s = t.p[i] * flip, u = t.p[i + 1], w = t.p[i + 2];
    out.push(round2(bot.x + side.x * s + toward.x * w), round2((bot.y || 0) + u), round2(bot.z + side.z * s + toward.z * w), t.p[i + 3], t.p[i + 4], t.p[i + 5]);
  }
  return out;
}

// Where a copycat is `seconds` into the round (the Studio's preview), timed like the game.
export function copycatAt(bot, start, seconds, frames = copycatFrames(bot, start)) {
  if (!frames) return null;
  const count = frames.length / TRACK_STRIDE, hz = bot.track.hz, length = (count - 1) / hz;
  let time = Math.max(0, seconds) * Math.max(0.75, Math.min(1.25, bot.replaySpeed || 1));
  if (length <= 0) time = 0;
  else if (bot.playback === "pingpong") { const p = time % (2 * length); time = p > length ? 2 * length - p : p; }
  else if (bot.playback === "once") time = Math.min(time, length);
  else time %= length;
  const k = time * hz, a = Math.min(count - 1, Math.floor(k)), b = Math.min(count - 1, a + 1), w = k - a;
  const at = (i) => frames[a * TRACK_STRIDE + i] + (frames[b * TRACK_STRIDE + i] - frames[a * TRACK_STRIDE + i]) * w;
  return { x: at(0), y: at(1), z: at(2), crouch: at(3), fired: frames[a * TRACK_STRIDE + 4] === 1 };
}

// True when the run passes through a wall, box, pillar or window wall (standing on top of a
// box is fine; doorways are open).
export function trackBlocked(drill, bot) {
  const frames = copycatFrames(bot, drill.start);
  if (!frames) return false;
  const solids = drill.items.filter((i) => i.kind === "wall" || (i.kind === "block" && ["box", "pillar", "window"].includes(i.shape)));
  for (let i = 0; i < frames.length; i += TRACK_STRIDE * 3) {
    const x = frames[i], y = frames[i + 1], z = frames[i + 2];
    for (const s of solids) {
      const a = rad(s.turn || 0), c = Math.cos(a), sn = Math.sin(a), dx = x - s.x, dz = z - s.z;
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c, wall = s.kind === "wall";
      const w = wall ? s.length : s.w, d = wall ? wallDepth(s) : s.d, h = wall ? s.height : s.h;
      const bottom = (s.y || 0) + (wall ? 0 : s.lift || 0);
      const inside = s.shape === "pillar" ? Math.hypot(lx, lz) < w / 2 : Math.abs(lx) < w / 2 && Math.abs(lz) < d / 2;
      if (inside && y < bottom + h - 0.3 && y + 1.6 > bottom) return true;
    }
  }
  return false;
}

function botTemplate(bot, drill, id, name, start, once) {
  const clear = drill.round.goal === "clear";
  const back = bot.back && !clear;
  const speed = SPEEDS[bot.speed] || SPEEDS.run;
  const behaviors = [];
  const run = bot.move === "copycat" ? copycatFrames(bot, start) : null;
  if (bot.jump === true && bot.move !== "copycat") {
    const bounded = (v, fallback, min, max) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : fallback));
    const min = r2(bounded(bot.jumpMin, 1.5, 0.5, 10));
    const max = r2(bounded(bot.jumpMax, 3, 0.5, 10));
    behaviors.push({ kind: "jump", interval: [Math.min(min, max), Math.max(min, max)], height: r2(bounded(bot.jumpHeight, DEFAULT_JUMP_HEIGHT, 0.2, 2)), playerGravity: true });
  }
  if (bot.move === "strafe") {
    behaviors.push({ kind: "strafe", ...strafeSettings(bot), counterStrafe: true });
  }
  const mine = bot.fireWhen !== "sees";
  if (run) {
    behaviors.push({
      kind: "replay", hz: bot.track.hz, frames: run, playback: bot.playback || "loop",
      speed: r2(Math.max(0.75, Math.min(1.25, bot.replaySpeed || 1))), randomStart: bot.randomStart === true,
      fireWhen: mine ? "mine" : "sees", hold: mine ? "move" : "stop",
    });
  }
  const p = plan(bot, start, once);
  if (p) {
    const waypoints = p.pts.map((q) => pos(q.x, q.y, q.z));
    const pauses = p.pts.map((q, i) => ({ at: i, wait: r2(q.wait || 0) })).filter((q) => q.wait > 0);
    if (p.loop) {
      // Loops forever: walks back to the first point instead of disappearing.
      behaviors.push({ kind: "path", waypoints, loop: true, speed, counterStrafe: true, ...(pauses.length ? { pauses } : {}) });
    } else {
      // Disappears at the last point and comes again from the first.
      const cross = {
        kind: "cross", waypoints, speed, respawn: back,
        interval: [r2(p.hidden), r2(p.hidden + (bot.move === "peek" ? 0.5 : 1))], killImmediate: false, counterStrafe: true,
      };
      if (pauses.length) cross.pauses = pauses;
      if (p.flashAt > 0) {
        const f = bot.flash;
        const t = flashTarget(bot, start);
        const from = p.pts[p.flashAt];
        const stop = { at: p.flashAt, target: pos(t.x, from.y + (f.height ?? 2.2), t.z), wait: r2(f.wait ?? 1) };
        if (f.agent && f.agent !== "phoenix") stop.agent = f.agent;
        const curves = (FLASH_AGENTS.find((a) => a[0] === (f.agent || "phoenix")) || [])[3];
        if (curves) stop.curve = curves.some((c) => c[0] === f.curve) ? f.curve : curves[0][0];
        cross.flashStops = [stop];
      }
      behaviors.push(cross);
    }
  }
  const s = shooter(bot.shoots);
  // A copycat that fires when you fired keeps running its route while it shoots.
  if (s && run && mine) s.engage = "move";
  if (s) behaviors.push(s);
  // Bots that disappear come back through their route; everyone else needs a respawn rule.
  if (!p || p.loop) {
    // Relocate moving bots through their original spawner so home and movement
    // state reset instead of continuing from the position where they died.
    behaviors.push(back ? { kind: "respawn", delay: [r2(bot.backAfter), r2(bot.backAfter + 0.3)], mode: bot.move === 'strafe' || bot.move === 'peek' || bot.move === 'copycat' ? 'reSpawner' : 'inPlace' } : { kind: "respawn", delay: [0.4, 0.9], mode: "never" });
  }
  const actor = { id, name, body: humanoid(bot), color: "#ff4655", behaviors, health: bot.hp || 150, ...(bot.hitSlow === true ? { hitSlow: true } : {}) };
  if (bot.crouchRandom === true) {
    const range = (a, b, first, last) => {
      const bounded = (v, fallback) => r2(Math.max(0.3, Math.min(10, Number.isFinite(v) ? v : fallback)));
      const lo = bounded(a, first), hi = bounded(b, last);
      return [Math.min(lo, hi), Math.max(lo, hi)];
    };
    actor.studioCrouch = { duration: range(bot.crouchMin, bot.crouchMax, 0.5, 1.2), interval: range(bot.crouchGapMin, bot.crouchGapMax, 2, 4) };
  }
  return actor;
}

function targetTemplate(zone, drill, id) {
  const clear = drill.round.goal === "clear";
  const behaviors = [];
  if (zone.motion === "drift") behaviors.push({ kind: "sway", amplitude: { x: 0.5, y: 0.2 }, frequency: 0.35, unit: "hz" });
  if (zone.motion === "fast") behaviors.push({ kind: "sway", amplitude: { x: 1.2, y: 0.35 }, frequency: 0.8, unit: "hz" });
  if (zone.vanish > 0) behaviors.push({ kind: "decay", lifetime: r2(zone.vanish), growTime: 0.08, minScale: 0.55 });
  behaviors.push(clear ? { kind: "respawn", delay: [0.4, 0.9], mode: "never" } : { kind: "respawn", delay: [0.05, 0.15], mode: "reSpawner" });
  const radius = TARGET_SIZES[zone.size] || TARGET_SIZES.medium;
  return { id, name: itemName(drill, zone), body: { shape: "sphere", headSize: radius, radius }, color: targetColor(drill), studioTargetContrast: true, behaviors };
}

// floorAt(x, z, nearY) -> floor height or null, or no floorAt to use the heights stored on
// the items. Only used on maps (the range floor is y = 0).
export function compile(drill, floorAt) {
  const onMap = drill.place !== "range";
  // Floors include the tops of structures, so bots and you can stand on built floors.
  const ground = (x, z, y) => (floorAt ? floorAt(x, z, y) ?? y ?? 0 : y ?? 0);
  const start = { x: drill.start.x, y: ground(drill.start.x, drill.start.z, drill.start.y), z: drill.start.z };
  const round = drill.round;
  const doc = {
    schemaVersion: 2,
    meta: { id: `studio-${drill.code || "new"}`, name: drill.name || "My drill", seed: 1 + Math.floor(Math.random() * 2e9), createdAt: 0 },
    environment: onMap
      ? { skyColor: "#111820", fogNear: 14, fogFar: 33, ambientIntensity: 2, keyLightIntensity: 3, fogEnabled: false, map: drill.place }
      : {
        skyColor: darkArena(drill) ? "#14171c" : "#c1c5cb", fogNear: 30, fogFar: 90, ambientIntensity: 1, keyLightIntensity: 1, lightingVersion: 2, fogEnabled: false,
        studioArenaSize: arenaSize(drill),
      },
    blocks: onMap ? [] : arenaBlocks(drill),
    playerSpawn: { position: pos(start.x, start.y, start.z), yaw: r2(rad(drill.start.facing || 0)) },
    spawners: [],
    actors: [],
    rules: {
      duration: Math.max(5, Math.min(600, round.time || 60)),
      scoring: round.goal === "track" ? "tracking" : "clicking",
      weapon: round.weapon || "vandal",
      playerMovable: !!round.move,
      // hold: the gun fires for as long as you hold the button (full auto, sprays);
      // single: one shot per click.
      fireMode: round.goal === "track" || round.auto !== false ? "hold" : "single",
    },
  };
  if (round.goal === "track") doc.rules.targetsInvincible = true;
  if (round.die) doc.rules.playerDeath = "endRound";
  if (round.ammo) doc.rules.limitedAmmo = true;
  if (round.goal === "clear") {
    const count = drill.items.reduce((n, i) => n + (i.kind === "bot" ? 1 : i.kind === "targets" ? i.count : 0), 0);
    doc.rules.moment = { parSeconds: Math.max(1, Math.round(round.par || Math.max(3, count * 2.5))) };
  }

  const oneByOne = round.order !== "together" && round.goal !== "track";
  const routes = [];
  let n = 0;
  for (const item of drill.items) {
    n += 1;
    if (item.kind === "wall") {
      const y = ground(item.x, item.z, item.y);
      doc.blocks.push({
        id: `wall-${n}`, shape: "box", position: pos(item.x, y + item.height / 2, item.z), rotationY: r2(rad(item.turn || 0)),
        size: pos(Math.max(0.2, item.length), Math.max(0.2, item.height), wallDepth(item)), color: "#59606b", collidable: true,
        // The game's "air wall": solid to walk into, but see-through and bullets pass.
        ...(item.invisible ? { bulletCollidable: false, transparent: true } : surfaceFor(drill, item)),
      });
    } else if (item.kind === "block") {
      doc.blocks.push({ ...gameBlock(item, `block-${n}`, ground(item.x, item.z, item.y)), ...surfaceFor(drill, item, item.shape === "floor") });
    } else if (item.kind === "smoke") {
      (doc.props ||= []).push({ kind: "smoke", id: `smoke-${n}`, position: pos(item.x, ground(item.x, item.z, item.y), item.z), agent: item.agent, at: Math.max(0, item.at || 0) });
    } else if (item.kind === "targets") {
      const id = `actor-${n}`;
      doc.actors.push(targetTemplate(item, drill, id));
      const y = ground(item.x, item.z, item.y) + (item.lift ?? 1.6);
      const facing = yawTo(item, start);
      doc.spawners.push({
        id: `spawner-${n}`, name: itemName(drill, item), kind: "area", actorTemplateId: id, position: pos(item.x, y, item.z),
        size: pos(Math.max(0, item.width), Math.max(0, item.height), 0), rotationY: r2(facing), faceTarget: true,
        maxAlive: Math.max(1, Math.round(item.count)), spawnDelay: [0.05, 0.2], minAngularGap: 2, minAngularGapFromPrevious: 4,
      });
    } else if (item.kind === "bot") {
      const id = `actor-${n}`;
      const bot = withFloors(item, ground);
      // Rushers walking a loop can't take turns; they start with the round.
      // Copycats run their recording from the round start too.
      const turnTaker = oneByOne && !(bot.move === "patrol" && !(bot.flash && bot.flash.on)) && bot.move !== "copycat";
      const tpl = botTemplate(bot, drill, id, itemName(drill, item), start, turnTaker);
      doc.actors.push(tpl);
      const run = tpl.behaviors.find((b) => b.kind === "replay");
      const first = run ? { x: run.frames[0], y: run.frames[1] - 0.3, z: run.frames[2] } : bot.route ? bot.route[0] : bot;
      // Faces you (and keeps turning to you), or a fixed direction set in the Studio.
      const fixed = typeof bot.facing === "number" && (bot.move === "still" || bot.move === "strafe");
      // Studio/player markers face local -Z; native humanoids face local +Z.
      const facing = (fixed ? rad(bot.facing) : yawTo(first, start)) + Math.PI;
      if (turnTaker) {
        const route = { templateId: id, streak: [1, 1] };
        if (bot.move === "still" || bot.move === "strafe") Object.assign(route, { at: pos(bot.x, bot.y, bot.z), rotationY: r2(facing) });
        if (fixed) route.fixed = true; // marker for the dispatcher below, removed there
        if (bot.move === "still") route.point = true;
        routes.push(route);
      } else {
        // A little above the floor: the game drops the bot onto whatever is there (a box, a step).
        doc.spawners.push({
          id: `spawner-${n}`, name: itemName(drill, item), kind: "area", actorTemplateId: id, position: pos(first.x, first.y + 0.3, first.z),
          // A copycat's height comes from its recording (jumps, stairs), not from the floor.
          size: pos(0, 0, 0), rotationY: r2(facing), faceTarget: !fixed, groundSnap: !run, maxAlive: 1,
          spawnDelay: [r2(Math.max(0.05, item.delay || 0)), r2(Math.max(0.05, item.delay || 0))],
        });
      }
    }
  }
  if (routes.length) {
    const clear = round.goal === "clear";
    doc.dispatchers = [{
      id: "dispatcher-1", name: "One at a time", routes,
      order: round.order === "inOrder" ? "sequence" : "shuffle",
      maxAlive: Math.max(1, Math.min(routes.length, Math.round(round.atOnce || 1))),
      interval: [r2(round.gap ?? 1), r2((round.gap ?? 1) + 0.5)],
      // One setting for all bots that take turns: they face you unless one has a fixed direction.
      faceTarget: !routes.some((r) => r.fixed),
      ...(clear ? { total: routes.length } : {}),
    }];
    for (const r of routes) delete r.fixed;
  }
  // Lobby category: Scenarios (timed clears), Fundamentals (range), Angle holding (bots
  // that shoot back on a map) or Pre-aim.
  const type = round.goal === "clear" ? "moment" : !onMap ? "basic" : drill.items.some((i) => i.kind === "bot" && i.shoots !== "off") ? "hold" : "aim";
  return { doc, type };
}


function withFloors(bot, ground) {
  const b = { ...bot, y: ground(bot.x, bot.z, bot.y) };
  if (bot.route) b.route = bot.route.map((p) => ({ ...p, y: ground(p.x, p.z, p.y) }));
  return b;
}
