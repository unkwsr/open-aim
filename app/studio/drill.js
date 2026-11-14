// The Studio's drill format and how it becomes a game scene.
//
// A drill is what the Studio edits: a place (the training range or a map), where you
// stand, the round rules and a list of things on the map (bots, target zones, walls,
// smokes). compile() turns it into the scene file the game plays (schemaVersion 2).

import { arenaSpan, arenaBlocks, surfaceFor, darkArena, targetColor } from './arena.js';
import { wallDepth } from './transform.js';
import { strafeSettings } from './strafe.js';

export const MAPS = [
  ["ascent", "Ascent"], ["bonsai", "Split"], ["triad", "Haven"], ["plummet", "Summit"],
  ["jam", "Lotus"], ["infinity", "Abyss"], ["rook", "Corrode"], ["duality", "Bind"],
  ["juliett", "Sunset"], ["pitt", "Pearl"], ["port", "Icebox"],
];
export const mapLabel = (id) => (MAPS.find((m) => m[0] === id) || [id, id])[1];

export const WEAPONS = [
  ["classic", "Classic"], ["shorty", "Shorty"], ["frenzy", "Frenzy"], ["ghost", "Ghost"], ["sheriff", "Sheriff"], ["headhunter", "Headhunter"],
  ["stinger", "Stinger"], ["spectre", "Spectre"], ["bucky", "Bucky"], ["judge", "Judge"],
  ["bulldog", "Bulldog"], ["guardian", "Guardian"], ["phantom", "Phantom"], ["vandal", "Vandal"],
  ["marshal", "Marshal"], ["outlaw", "Outlaw"], ["operator", "Operator"], ["tourdeforce", "Tour de Force"], ["ares", "Ares"], ["odin", "Odin"],
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
// Pop heights (m above the thrower's floor). Reyna's eye and KAY/O's lob can go higher.
export const FLASH_HEIGHTS = [[1.2, "Low"], [2.2, "Head height"], [3.5, "High"]];
export const FLASH_HEIGHTS_HIGH = [...FLASH_HEIGHTS, [5, "Very high"], [6.5, "Highest"]];
export const flashHeights = (agent) => (agent === "reyna" || agent === "kayo" ? FLASH_HEIGHTS_HIGH : FLASH_HEIGHTS);
// Game numbers (BiMsX6Xn.js): bots throw from 1.2 m above their feet; Reyna's eye flies straight for 0.4 s
// and at most 8.41 m (through walls), turns on 0.4 s later and lasts 1.6 s; KAY/O lobs with 0.7 x 9.8 m/s²
// gravity and pops at the star after 0.7 s.
export const FLASH_THROW_Y = 1.2, REYNA_REACH = 8.41;
// One flash's flight for the preview: point(u) for u 0..1 of the flight, where it pops (at), flight
// seconds (fly) and how long the pop stays visible (glow). from/target: {x, y, z} (y: thrower floor + 1.2 /
// floor + pop height).
// Yoru's Blindside bounces: where it hits and the surface it bounces off. "wall" (default): the star is on a
// wall at the pop height, facing the thrower; "floor": the star is on the ground under it. floorY: thrower's floor.
export function yoruBounce(flash, from, star, floorY) {
  // Aimed with the mouse in the 3D view: the exact point and surface (normal turned toward the thrower).
  if (flash.hit && flash.normal) {
    const h = flash.hit, n = flash.normal, toward = (from.x - h.x) * n.x + ((from.y ?? 0) + 1.2 - h.y) * n.y + (from.z - h.z) * n.z;
    const s = toward < 0 ? -1 : 1, len = Math.hypot(n.x, n.y, n.z) || 1;
    return { target: { x: h.x, y: h.y, z: h.z }, normal: { x: s * n.x / len, y: s * n.y / len, z: s * n.z / len } };
  }
  if (flash.bounce === "floor") return { target: { x: star.x, y: floorY, z: star.z }, normal: { x: 0, y: 1, z: 0 } };
  const nx = from.x - star.x, nz = from.z - star.z, n = Math.hypot(nx, nz) || 1;
  return { target: { x: star.x, y: floorY + (flash.height ?? 2.2), z: star.z }, normal: { x: nx / n, y: 0, z: nz / n } };
}
// The game's Yoru flight (BiMsX6Xn ym/bf, zt): arc at 29 m/s with 0.45 g to the bounce, then rebound for 0.6 s.
const YORU = { speed: 29, gravity: 9.8 * 0.45, windup: 0.6, floatUp: 0.98, keep: 0.3 };
function yoruFlight(o, e, t) {
  const r = YORU.speed, s = YORU.gravity, a = e.x - o.x, z = e.z - o.z, c = Math.hypot(a, z), l = e.y - o.y, A = r * r, h = A * A - s * (s * c * c + 2 * l * A);
  let v0, T;
  if (c > 1e-6 && h >= 0) { const C = (A - Math.sqrt(h)) / (s * c), v = 1 / Math.sqrt(1 + C * C); v0 = { x: a / c * r * v, y: r * C * v, z: z / c * r * v }; T = c / (r * v); }
  else { const C = Math.hypot(a, l, z) || 1; T = C / r; v0 = { x: a / C * r, y: l / C * r + 0.5 * s * T, z: z / C * r }; }
  const d = { x: v0.x, y: v0.y - s * T, z: v0.z }, m = d.x * t.x + d.y * t.y + d.z * t.z, k = YORU.keep;
  const v1 = { x: (d.x - t.x * m) * k - t.x * m * k, y: (d.y - t.y * m) * k - t.y * m * k, z: (d.z - t.z * m) * k - t.z * m * k };
  const at = (time) => time <= T ? { x: o.x + v0.x * time, y: o.y + v0.y * time - 0.5 * s * time * time, z: o.z + v0.z * time }
    : (q => ({ x: e.x + v1.x * q, y: e.y + v1.y * q + 0.5 * YORU.floatUp * q * q, z: e.z + v1.z * q }))(Math.min(time - T, YORU.windup));
  return { bounceAt: T, total: T + YORU.windup, at };
}

export function flashFlight(agent, from, target, curve, normal) {
  const dx = target.x - from.x, dy = target.y - from.y, dz = target.z - from.z;
  if (agent === "yoru" && normal) {
    const f = yoruFlight(from, target, normal);
    return { at: f.at(f.total), fly: f.total, glow: 0.6, bounce: { ...target }, point: (u) => f.at(u * f.total) };
  }
  if (agent === "reyna") {
    const d = Math.hypot(dx, dy, dz) || 1, k = Math.min(d, REYNA_REACH) / d;
    const at = { x: from.x + dx * k, y: from.y + dy * k, z: from.z + dz * k };
    return { at, fly: 0.4, glow: 2, short: d > REYNA_REACH, point: (u) => ({ x: from.x + dx * k * u, y: from.y + dy * k * u, z: from.z + dz * k * u }) };
  }
  if (agent === "kayo") {
    const T = FLASH_FUSE, g = 9.8 * 0.7, vy = (dy + 0.5 * g * T * T) / T;
    return { at: { ...target }, fly: T, glow: 0.6, point: (u) => { const s = u * T; return { x: from.x + dx * u, y: from.y + vy * s - 0.5 * g * s * s, z: from.z + dz * u }; } };
  }
  // Phoenix and the rest: the map curve, rising to the pop height with a small arc.
  return { at: { ...target }, fly: FLASH_FUSE, glow: 0.6, point: (u) => { const q = curve ? curve(u) : { x: from.x + dx * u, z: from.z + dz * u }; return { x: q.x, y: from.y + dy * u + Math.sin(Math.PI * u) * 0.8, z: q.z }; } };
}

// Only Omen in the Studio: the other agents' smokes didn't work as Studio smokes (10 Nov 2026).
// Older drills with another agent's smoke open as Omen (normalize below).
export const SMOKE_AGENTS = [["omen", "Omen"]];
// The game's smokes (JQ in CnrSARj_.js): seconds at full size, how far the cloud's middle sits above
// where it lands, and its radius. Sight is blocked by a ball of that radius around the middle.
export const SMOKE_SPECS = {
  brimstone: { life: 19.25, lift: 0, radius: 4.1 }, omen: { life: 14.7, lift: 0.65, radius: 4.1 },
  astra: { life: 15, lift: 0, radius: 4.75 }, clove: { life: 13.5, lift: 0.65, radius: 4.1 },
  miks: { life: 16.25, lift: 0, radius: 4.1 }, jett: { life: 2.5, lift: 0.65, radius: 3.35 },
};
export const smokeSpec = (s) => SMOKE_SPECS[s.agent] || SMOKE_SPECS.omen;

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
export const COMPILER = 23; // 23: random player starts (playerSpawns); 22: per-spot peek strafe width, copycat with spots starts at round start; 21: Studio smokes are always Omen; 20: peeker strafe width (peekWidth) and "random" strafe-or-hold at the peek (dispatcher route groups, aim-dispatch-group in BiMsX6Xn.js); 19: a peeker with its own dispatcher (random wait/spots) waits back-after after a kill; 18: flashing/once peekers wait their own back-after time after a kill; // 16: Unpredictable strafe taps / full speed, crouch "Only when fully stopped"; 17: Yoru flash bounce surface (normal)
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
    // peekStrafe (peekers): true strafes A-D at the peek, false holds still, "random" picks one each time it
    // comes out. peekWidth: how wide that A-D strafe is (metres, end to end).
    peekWidth: PEEK_WIDTH,
    // spots: extra places it can show up instead ({ x, y, z, route? }), one picked at random each time.
    // randomWait (peekers): 0 to this many extra seconds behind cover, different every peek.
    spots: [], randomWait: 0,
    // zone (holders, strafers, peekers): it shows up anywhere inside a w x d metre area (w across
    // your view, d toward you) around its spot - a peeker's peek spot - never at a point you placed.
    zone: { on: false, w: 6, d: 2, turn: 0 },
    // tradeOf: id of another bot; this one shows up only when you kill that one, tradeMin-tradeMax
    // seconds later (a trade), once per kill. null: shows up with the round / its trigger line.
    // tradeStart: a trade that is also there when the round starts (so a ring of trades can begin).
    // tradeStartMin/Max: when that first appearance comes, seconds into the round (random between).
    tradeOf: null, tradeMin: 0.3, tradeMax: 1, tradeStart: false, tradeStartMin: 0, tradeStartMax: 0,
    hitSlow: false, jump: false, jumpHeight: DEFAULT_JUMP_HEIGHT, jumpMin: 1.5, jumpMax: 3,
    // crouchStill: occasional crouches start only once the bot has fully stopped (a strafer stays stopped until it stands up).
    crouchRandom: false, crouchStill: true, crouchMin: 0.5, crouchMax: 1.2, crouchGapMin: 2, crouchGapMax: 4,
    facing: null, // null: turns to face you; a number: always faces that way (game yaw, degrees)
    flash: { on: false, agent: "phoenix", curve: "right", wait: 1, height: 2.2, at: 1, target: null, bounce: "wall" }, // bounce: Yoru only, "wall" | "floor"
    // trigger: null (shows up with the round) or { a: {x, z}, b: {x, z} }: a line on the map;
    // the bot shows up `delay` seconds after you cross it.
    trigger: null,
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
  // and preserve custom colors on individual building pieces.
  if (drill.arenaTheme === 'original') {
    drill.floorSurface ||= 'plain'; drill.wallSurface ||= 'plain';
  }
  drill.arenaTheme = darkArena(drill) ? 'charcoal' : 'light';
  for (const key of ['floorSurface', 'wallSurface']) if (drill[key] === 'stone') drill[key] = 'tile';
  for (const item of drill.items) if (item.kind === 'smoke' && !SMOKE_AGENTS.some(([a]) => a === item.agent)) item.agent = 'omen';
  for (const item of drill.items) if (item.kind === 'wall' || item.kind === 'block') {
    if (item.surface === 'stone') item.surface = 'tile';
    if (!/^#[0-9a-f]{6}$/i.test(item.surfaceColor || '')) delete item.surfaceColor;
  }
  for (const it of drill.items) {
    if (it.kind !== "bot") continue;
    const fresh = newBot(it.move, it);
    for (const k of ["spots", "randomWait", "zone", "tradeOf", "tradeMin", "tradeMax", "tradeStart", "tradeStartMin", "tradeStartMax", "peekStrafe", "peekWidth", "coverWait", "flash", "unpredictable", "hitSlow", "jump", "jumpHeight", "jumpMin", "jumpMax", "crouchRandom", "crouchStill", "crouchMin", "crouchMax", "crouchGapMin", "crouchGapMax",
      "track", "playback", "replaySpeed", "mirror", "randomStart", "fireWhen", "trigger"]) if (it[k] === undefined) it[k] = fresh[k];
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

// studio-air-floor: a Floor piece nobody sees. You and the bots stand on it; bullets and sight pass through.
export const newAirFloor = (at) => ({ ...newBlock("floor", at), id: newId("airfl"), invisible: true, color: "#7fd8ff" });

const OPEN_FACE = { front: "pz", back: "nz", left: "nx", right: "px" };

// The game block for a structure (center position, size, rotation, shape details).
export function gameBlock(b, id, baseY) {
  const shape = { box: "box", floor: "box", ramp: "ramp", stairs: "stairs", window: "opening", door: "opening", pillar: "cylinder", room: "hollow" }[b.shape];
  const w = Math.max(0.05, b.w), h = Math.max(0.05, b.h), d = Math.max(0.05, b.d); // studio-free-size
  const block = {
    id, shape, position: pos(b.x, baseY + (b.lift || 0) + h / 2, b.z), rotationY: r2(rad(b.turn || 0)),
    size: pos(b.shape === "pillar" ? w : w, h, b.shape === "pillar" ? w : d), color: b.color || "#6b7280", collidable: true,
  };
  if (b.shape === "stairs") block.steps = Math.max(2, Math.min(400, Math.round(h / 0.25)));
  // Keep the default opening proportions as the whole window wall is resized.
  if (b.shape === "window") block.hole = { width: r2(w * .75), height: r2(h * .4), offsetX: 0, offsetY: r2(h / 30) };
  if (b.shape === "door") { const dh = r2(h * (2.2 / 3)); block.hole = { width: r2(w * .35), height: dh, offsetX: 0, offsetY: r2((dh - h) / 2) }; }
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
// height: metres it floats above the floor (0: on the floor like in the game; raise it for one-ways).
// life: seconds it stays at full size (0: as long as that agent's smoke in the game).
export const newSmoke = (at) => ({ id: newId("smoke"), kind: "smoke", x: at.x, y: at.y, z: at.z, agent: "omen", at: 0, height: 0, life: 0 });

export const itemName = (drill, item) => {
  const same = drill.items.filter((i) => (i.kind === "bot" ? i.kind === item.kind && i.move === item.move
    : i.kind === "block" ? i.kind === item.kind && i.shape === item.shape && !!i.invisible === !!item.invisible
    : i.kind === item.kind && !!i.invisible === !!item.invisible));
  const n = same.indexOf(item) + 1;
  if (item.kind === "bot") return `${MOVES[item.move].short} ${n}`;
  if (item.kind === "block") return item.invisible ? `Invisible floor ${n}` : `${BLOCK_SHAPES[item.shape].label} ${n}`;
  if (item.invisible) return `Invisible wall ${n}`;
  return `${{ targets: "Targets", wall: "Wall", smoke: "Smoke" }[item.kind]} ${n}`;
};

// ---------- checks, in plain words ----------

// A starter trigger line for a bot: across your way to it, 40% of the way from your start,
// 6 m long. You drag its ends where you want.
export function newTrigger(bot, start) {
  const dx = bot.x - start.x, dz = bot.z - start.z, len = Math.hypot(dx, dz) || 1;
  const mx = start.x + dx * 0.4, mz = start.z + dz * 0.4, ax = -dz / len * 3, az = dx / len * 3;
  const r1 = (n) => Math.round(n * 10) / 10;
  return { a: { x: r1(mx + ax), z: r1(mz + az) }, b: { x: r1(mx - ax), z: r1(mz - az) } };
}

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
    if (item.kind === "bot" && item.trigger && !drill.round.move) out.push({ id: item.id, text: `${name} waits for you to cross its line, but you can't move. Turn on "I can walk around" in drill settings.` });
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
  for (const ring of stuckTradeRings(drill)) {
    out.push({ id: ring[0].id, text: `${ring.map((b) => itemName(drill, b)).join(", ")} each wait for a kill of another, so none of them ever shows up. Select one and turn on "Also there at the start" under Shows up.`, soft: true });
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
  if (bot.weapon) Object.assign(body, { weapon: bot.weapon }); // no dropWeapon: bots keep their gun when they die
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

// A-D steps around the peek spot (metres) and the short stop after each, repeated for the whole
// time out in the open, so a 5 s peek strafes for 5 s instead of standing still and strafing at the end.
// The steps are for the default 1.4 m width; a peeker's "How wide" (peekWidth) scales them.
export const PEEK_WIDTH = 1.4;
const PEEK_JIGGLE = [0.7, -0.5, 0.6, -0.7, 0.4, -0.6];
const JIGGLE_WAIT = [0.15, 0.25, 0.2];
const HOP_EXTRA = 0.23;
// An extra spot can have its own strafe width (spot.peekWidth); otherwise it uses the bot's.
export const spotPeekWidth = (bot, spot) => peekWidth(spot && Number.isFinite(spot.peekWidth) ? { ...bot, peekWidth: spot.peekWidth } : bot);
export const peekWidth = (bot) => Math.max(0.4, Math.min(8, Number.isFinite(bot.peekWidth) ? bot.peekWidth : PEEK_WIDTH));
// What a peeker does at the peek: [true] strafes, [false] holds, [true, false] either one at random each time.
export const peekModes = (bot) => (bot.peekStrafe === "random" ? [true, false] : [!!bot.peekStrafe]);
function peekSteps(spot, a, open, speed, width = PEEK_WIDTH) {
  const steps = [];
  const scale = width / PEEK_WIDTH;
  let t = 0, prev = 0;
  for (let i = 0; t < open; i++) {
    const s = PEEK_JIGGLE[i % PEEK_JIGGLE.length] * scale;
    const wait = JIGGLE_WAIT[i % JIGGLE_WAIT.length];
    // + HOP_EXTRA: in the game each short hop also spends ~0.23 s speeding up and stopping
    // (measured with previews/bot-motion/peek-open-time.mjs), so the total matches the setting.
    t += Math.abs(s - prev) / speed + HOP_EXTRA + wait;
    prev = s;
    steps.push({ x: spot.x + a.x * s, y: spot.y, z: spot.z + a.z * s, wait });
  }
  return steps;
}

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
    if (bot.peekStrafe) {
      // Arrive at the spot and start strafing right away; the steps fill the whole time in the open.
      pts.push({ ...spot, wait: 0.1 });
      pts.push(...peekSteps(spot, a, Math.max(0.2, bot.wait - 0.1), SPEEDS[bot.speed] || SPEEDS.run, peekWidth(bot)));
    } else pts.push({ ...spot, wait: Math.max(0.1, bot.wait) });
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
  const all = take.ticks.slice(0, (take.last || take.ticks.length - 1) + 1);
  const tickOf = [], ticks = [];
  all.forEach((k, tick) => { if (Array.isArray(k)) { tickOf.push(tick); ticks.push(k); } });
  if (ticks.length < 2) return null;
  const dt = take.dt, o = ticks[0];
  // Your Cloudburst smokes: [index into ticks, x, y, z], in the order they landed.
  const smokeAt = new Map(tickOf.map((tick, i) => [tick, i]));
  const smokes = Object.entries(take.smokes || {})
    .map(([tick, at]) => [smokeAt.get(Number(tick)), ...(Array.isArray(at) ? at : [])])
    .filter((s) => s[0] !== undefined && s.length === 4 && s.every(Number.isFinite))
    .sort((a, b) => a[0] - b[0]);
  let first = ticks.findIndex((k) => Math.hypot(k[0] - o[0], k[2] - o[2]) > 0.02 || k[3] > 0 || k[4] || k[5]);
  if (smokes.length && (first < 0 || smokes[0][0] < first)) first = smokes[0][0]; // a smoke counts as moving
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
  const track = { hz: TRACK_HZ, secs: round2((n - 1) / TRACK_HZ), p };
  // smokes: [seconds into the run, side, up, toward] per smoke, like the run's own positions.
  const runSmokes = [];
  for (const [i, x, y, z] of smokes) {
    const t = (i - first) * dt;
    if (t < 0 || t > track.secs) continue;
    const dx = x - o[0], dz = z - o[2];
    runSmokes.push([round2(t), round2(dx * side.x + dz * side.z), round2(y - o[1]), round2(dx * toward.x + dz * toward.z)]);
  }
  if (runSmokes.length) track.smokes = runSmokes;
  return track;
}

// The run's smokes in world positions, as the game plays them: [seconds, x, y, z, ...] (flat).
export function copycatSmokes(bot, start) {
  const t = bot.track;
  if (!t || !Array.isArray(t.smokes) || !t.smokes.length) return null;
  const { toward, side } = trackAxes(bot, start), flip = bot.mirror ? -1 : 1, out = [];
  for (const s of t.smokes) {
    if (!Array.isArray(s) || s.length !== 4 || !s.every(Number.isFinite)) continue;
    const [at, sd, u, w] = s;
    out.push(at, round2(bot.x + side.x * sd * flip + toward.x * w), round2((bot.y || 0) + u), round2(bot.z + side.z * sd * flip + toward.z * w));
  }
  return out.length ? out : null;
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

// ---------- random spots and random peek timing ----------
// Bots that can't use them: a copycat replays a run recorded from one place; a bot with a
// trigger line waits for you at its own spawner.
// Every bot can have random spots: bots with a trigger line or a trade use their own dispatcher, which
// waits for the line / the kill (game patch aim-dispatch-gates in BiMsX6Xn.js); a copycat runs its
// recording from the spot it got (turned toward your start, like at its own spot).
export const canRandomSpot = (bot) => bot.kind === "bot";
// The bot this one trades (shows up after you kill it), if that bot is still in the drill.
export const tradeTarget = (drill, bot) => (bot && bot.tradeOf ? drill.items.find((i) => i.kind === "bot" && i.id === bot.tradeOf && i.id !== bot.id) || null : null);
// Rings of trades where every bot waits for a kill and none is there at the start: nobody would
// ever show up. Returns each such ring once, as its bots in trade order.
export function stuckTradeRings(drill) {
  const rings = [], done = new Set();
  for (const first of drill.items) {
    if (first.kind !== "bot" || done.has(first.id)) continue;
    const path = [];
    let bot = first;
    while (bot && !done.has(bot.id) && !path.includes(bot)) { path.push(bot); bot = tradeTarget(drill, bot); }
    if (bot && path.includes(bot)) {
      const ring = path.slice(path.indexOf(bot));
      if (!ring.some((b) => b.tradeStart)) rings.push(ring);
    }
    for (const b of path) done.add(b.id);
  }
  return rings;
}
// Every place the bot can show up: its own first, then the extra spots (each with its own route).
export function botSpots(bot) {
  const own = { x: bot.x, y: bot.y, z: bot.z, ...(bot.route ? { route: bot.route } : {}) };
  if (!canRandomSpot(bot) || !Array.isArray(bot.spots)) return [own];
  return [own, ...bot.spots.filter((s) => s && Number.isFinite(s.x) && Number.isFinite(s.z) && (!bot.route || (Array.isArray(s.route) && s.route.length >= 2)))];
}
// ---------- random zones ----------
export const ZONE_MOVES = new Set(["still", "strafe", "peek"]);
export const hasZone = (bot) => bot.kind === "bot" && ZONE_MOVES.has(bot.move) && !!(bot.zone && bot.zone.on) && (bot.zone.w > 0 || bot.zone.d > 0);
// The zone's middle: the peek spot for a peeker, the bot itself otherwise.
export const zoneCenter = (bot, spot = bot) => (bot.move === "peek" && spot.route ? spot.route[1] : spot);
// The zone's two directions on the map: w along `a` (across your view when turn is 0), d along `t`.
// zone.turn (degrees, -90..90) turns the zone around its middle.
export const zoneTurn = (bot) => Math.max(-90, Math.min(90, Number.isFinite(bot.zone && bot.zone.turn) ? bot.zone.turn : 0));
export function zoneAxes(bot, start, c) {
  const a0 = acrossFrom(c, start), t0 = { x: -a0.z, z: a0.x };
  const th = (zoneTurn(bot) * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
  return { a: { x: a0.x * cs + t0.x * sn, z: a0.z * cs + t0.z * sn }, t: { x: t0.x * cs - a0.x * sn, z: t0.z * cs - a0.z * sn } };
}
// Turn (degrees) that points the zone's width toward map point p: what dragging its turn handle sets.
export function zoneTurnToward(bot, start, c, p) {
  const a0 = acrossFrom(c, start), t0 = { x: -a0.z, z: a0.x };
  const dx = p.x - c.x, dz = p.z - c.z;
  let deg = (Math.atan2(dx * t0.x + dz * t0.z, dx * a0.x + dz * a0.z) * 180) / Math.PI;
  while (deg > 90) deg -= 180;
  while (deg < -90) deg += 180;
  return Math.round(deg);
}
// The end of the zone's width, where the Studio draws its turn handle.
export function zoneTurnHandle(bot, start, spot = bot) {
  const c = zoneCenter(bot, spot), { a } = zoneAxes(bot, start, c), r = Math.max(0.6, bot.zone.w / 2) + 0.8;
  return { x: c.x + a.x * r, z: c.z + a.z * r };
}
// The zone's corners on the map, for drawing and checks.
export function zoneCorners(bot, start, spot = bot) {
  const c = zoneCenter(bot, spot), { a, t } = zoneAxes(bot, start, c);
  const hw = Math.max(0, bot.zone.w) / 2, hd = Math.max(0, bot.zone.d) / 2;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, u]) => ({ x: c.x + a.x * hw * s + t.x * hd * u, z: c.z + a.z * hw * s + t.z * hd * u }));
}
// Holders and strafers with a zone and no extra spots use the game's own area spawner: a new random
// point every time they show up. Everything else with a zone gets hidden points picked here.
// (The spawner's rotation also sets a fixed-facing bot's direction, so a turned zone on such a bot
// uses hidden points instead.)
export const zoneSpawner = (bot) => hasZone(bot) && bot.move !== "peek" && botSpots(bot).length === 1 && !(typeof bot.facing === "number" && zoneTurn(bot) !== 0);
// The game turns an area spawner by its rotationY; this is the zone's turn in the game's direction.
export const ZONE_TURN_SIGN = -1; // measured: the game turns areas the other way round (random-zone-check.mjs)
// Hidden points inside a zone (each Play from the Studio picks new ones; never shown in the Studio).
const ZONE_POINTS = 12;
function zoneSamples(bot, start, spot, count, floorAt) {
  const c = zoneCenter(bot, spot), { a, t } = zoneAxes(bot, start, c);
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 12; tries++) {
    const s = (Math.random() - 0.5) * bot.zone.w, u = (Math.random() - 0.5) * bot.zone.d;
    const x = r2(c.x + a.x * s + t.x * u), z = r2(c.z + a.z * s + t.z * u);
    const y = floorAt ? floorAt(x, z, c.y ?? 0) : c.y ?? 0;
    if (y === null || y === undefined) continue; // off the map's floor
    // Keep points apart, so twelve picks spread over the zone.
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 0.6) && tries < count * 8) continue;
    out.push({ x, y, z });
  }
  return out.length ? out : [{ x: c.x, y: c.y ?? 0, z: c.z }];
}
// Every place the bot can show up once zones are applied: each spot, or for a zone hidden points
// around each spot (a peeker keeps its cover; its peek spot moves).
function spotsWithZones(bot, start, floorAt) {
  const spots = botSpots(bot);
  if (!hasZone(bot)) return spots;
  const per = Math.max(2, Math.floor(ZONE_POINTS / spots.length));
  return spots.flatMap((s) => zoneSamples(bot, start, s, per, floorAt).map((p) => bot.move === "peek"
    ? { ...s, route: [s.route[0], { ...s.route[1], x: p.x, y: p.y, z: p.z }] }
    : { x: p.x, y: p.y, z: p.z }));
}

// A bot gets its own dispatcher (one entry per spot, picked at random, random gap) when it has
// extra spots, a random wait, or a zone the area spawner can't do; otherwise it compiles as before.
// A peeker set to strafe-or-hold at random needs one too: one actor per way, picked each time it comes out.
export const usesOwnDispatcher = (bot) => canRandomSpot(bot) && !zoneSpawner(bot) && (botSpots(bot).length > 1 || hasZone(bot) || (bot.move === "peek" && ((bot.randomWait || 0) > 0 || bot.peekStrafe === "random")));

function botTemplate(bot, drill, id, name, start, once) {
  // Random strafe-or-hold where the game can't pick each time (a trigger line or a trade): picked once per Play.
  if (bot.move === "peek" && bot.peekStrafe === "random") bot = { ...bot, peekStrafe: Math.random() < 0.5 };
  const clear = drill.round.goal === "clear";
  const back = bot.back && !clear;
  const speed = SPEEDS[bot.speed] || SPEEDS.run;
  const behaviors = [];
  const run = bot.move === "copycat" ? copycatFrames(bot, start) : null;
  const runSmokes = run ? copycatSmokes(bot, start) : null;
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
      ...(runSmokes ? { smokes: runSmokes } : {}),
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
        // After a kill it waits its own "back after" time, not the cover wait (interval is for hiding between peeks).
        ...(back ? { killDelay: [r2(bot.backAfter ?? 1.5), r2((bot.backAfter ?? 1.5) + 0.3)] } : {}),
      };
      if (pauses.length) cross.pauses = pauses;
      if (p.flashAt > 0) {
        const f = bot.flash;
        const t = flashTarget(bot, start);
        const from = p.pts[p.flashAt];
        const stop = { at: p.flashAt, target: pos(t.x, from.y + (f.height ?? 2.2), t.z), wait: r2(f.wait ?? 1) };
        if (f.agent && f.agent !== "phoenix") stop.agent = f.agent;
        // Yoru bounces off a real surface: without a normal the game assumes a floor at the star (mid-air bounce).
        if (f.agent === "yoru") {
          const yb = yoruBounce(f, from, t, from.y ?? 0);
          stop.target = pos(yb.target.x, yb.target.y, yb.target.z);
          stop.normal = { x: r2(yb.normal.x), y: r2(yb.normal.y), z: r2(yb.normal.z) };
        }
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
    behaviors.push(back ? { kind: "respawn", delay: [r2(bot.backAfter), r2(bot.backAfter + 0.3)], mode: bot.move === 'strafe' || bot.move === 'peek' || bot.move === 'copycat' || zoneSpawner(bot) ? 'reSpawner' : 'inPlace' } : { kind: "respawn", delay: [0.4, 0.9], mode: "never" });
  }
  const actor = { id, name, body: humanoid(bot), color: "#ff4655", behaviors, health: bot.hp || 150, ...(bot.hitSlow === true ? { hitSlow: true } : {}) };
  if (bot.crouchRandom === true) {
    const range = (a, b, first, last) => {
      const bounded = (v, fallback) => r2(Math.max(0.3, Math.min(10, Number.isFinite(v) ? v : fallback)));
      const lo = bounded(a, first), hi = bounded(b, last);
      return [Math.min(lo, hi), Math.max(lo, hi)];
    };
    actor.studioCrouch = { duration: range(bot.crouchMin, bot.crouchMax, 0.5, 1.2), interval: range(bot.crouchGapMin, bot.crouchGapMax, 2, 4), still: bot.crouchStill !== false };
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
        studioArenaSize: arenaSpan(drill), // studio-arena-rect: view distance reaches the farthest edge
      },
    blocks: onMap ? [] : arenaBlocks(drill),
    playerSpawn: { position: pos(start.x, start.y, start.z), yaw: r2(rad(drill.start.facing || 0)) },
    // Extra places you can start (Your start > Random starts): each round the game picks one of these
    // or your main start (game patch aim-random-start in OkAdunfX.js).
    ...(Array.isArray(drill.start.spots) && drill.start.spots.length ? { playerSpawns: drill.start.spots.map((s) => ({ position: pos(s.x, ground(s.x, s.z, s.y), s.z), yaw: r2(rad(s.facing ?? drill.start.facing ?? 0)) })) } : {}),
    spawners: [],
    actors: [],
    rules: {
      duration: Math.max(5, Math.min(1800, round.time || 60)), // studio-30min: up to 30 min
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
  if (round.heal) doc.rules.healOnKill = true; // studio-heal-on-kill
  if (round.ammo) doc.rules.limitedAmmo = true;
  if (round.goal === "clear") {
    const count = drill.items.reduce((n, i) => n + (i.kind === "bot" ? 1 : i.kind === "targets" ? i.count : 0), 0);
    doc.rules.moment = { parSeconds: Math.max(1, Math.round(round.par || Math.max(3, count * 2.5))) };
  }

  const oneByOne = round.order !== "together" && round.goal !== "track";
  const routes = [];
  const ownDispatchers = [];
  let turnBots = 0; // bots taking turns (one with random spots has several routes but counts once)
  // Each item's number n (its actor is actor-n), so a trade can name the bot it waits for.
  const itemIndex = new Map(drill.items.map((it, i) => [it.id, i + 1]));
  let n = 0;
  for (const item of drill.items) {
    n += 1;
    if (item.kind === "wall") {
      const y = ground(item.x, item.z, item.y);
      doc.blocks.push({
        id: `wall-${n}`, shape: "box", position: pos(item.x, y + item.height / 2, item.z), rotationY: r2(rad(item.turn || 0)),
        size: pos(Math.max(0.05, item.length), Math.max(0.05, item.height), wallDepth(item)), color: "#59606b", collidable: true,
        // The game's "air wall": solid to walk into, but see-through and bullets pass.
        ...(item.invisible ? { bulletCollidable: false, transparent: true } : surfaceFor(drill, item)),
      });
    } else if (item.kind === "block") {
      doc.blocks.push({ ...gameBlock(item, `block-${n}`, ground(item.x, item.z, item.y)), ...(item.invisible ? { bulletCollidable: false, transparent: true } : surfaceFor(drill, item, item.shape === "floor")) });
    } else if (item.kind === "smoke") {
      // A raised smoke is just placed higher; a set life replaces the agent's (game patch aim-smoke-life in CnrSARj_.js).
      const lift = Math.max(0, Math.min(30, item.height || 0)), life = Math.max(0, Math.min(1800, item.life || 0)); // studio-30min
      (doc.props ||= []).push({ kind: "smoke", id: `smoke-${n}`, position: pos(item.x, ground(item.x, item.z, item.y) + lift, item.z), agent: SMOKE_AGENTS.some(([k]) => k === item.agent) ? item.agent : "omen", at: Math.max(0, item.at || 0), ...(life > 0 ? { life: r2(life) } : {}) });
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
      // A bot with a trigger line waits for you, not for its turn.
      const trades = tradeTarget(drill, item);
      if (trades) {
        // A trade: waits for you to kill the other bot (any of its actors), then swings once,
        // tradeMin-tradeMax s later. It doesn't come back by itself; the next kill brings it again.
        const tb = { ...bot, back: false, trigger: null };
        const tTpl = botTemplate(tb, drill, id, itemName(drill, item), start, true);
        doc.actors.push(tTpl);
        const tFirst = tb.route ? tb.route[0] : tb;
        const tFixed = typeof tb.facing === "number" && (tb.move === "still" || tb.move === "strafe");
        const tFacing = (tFixed ? rad(tb.facing) : yawTo(tFirst, start)) + Math.PI;
        const k = itemIndex.get(trades.id);
        const lo = Math.max(0, Math.min(5, item.tradeMin ?? 0.3)), hi = Math.max(lo, Math.min(5, item.tradeMax ?? 1));
        // studio-trade-kill (BiMsX6Xn.js): every actor id the traded bot can have.
        const afterKill = [`actor-${k}`, ...Array.from({ length: 63 }, (_, v) => `actor-${k}-spot${v + 2}`)];
        // "Also there at the start": its first appearance doesn't wait for a kill (afterKillFirst).
        // With a start window it comes a random time into the round (the game picks it each round).
        const sLo = Math.max(0, Math.min(15, item.tradeStartMin ?? 0)), sHi = Math.max(sLo, Math.min(15, item.tradeStartMax ?? 0));
        const first = item.tradeStart ? { afterKillFirst: sHi > 0 ? [r2(sLo), r2(sHi)] : true } : {};
        if (usesOwnDispatcher(item)) {
          // Random spots (or a random strafe-or-hold peek): each trade swings from a random spot.
          doc.actors.pop();
          ownDispatchers.push(randomSpotDispatcher(item, n, drill, start, ground, floorAt, { afterKill, delay: [r2(lo), r2(hi)], first }));
          continue;
        }
        doc.spawners.push({
          id: `spawner-${n}`, name: itemName(drill, item), kind: "area", actorTemplateId: id, position: pos(tFirst.x, tFirst.y + 0.3, tFirst.z),
          size: pos(0, 0, 0), rotationY: r2(tFacing), faceTarget: !tFixed, groundSnap: true, maxAlive: 1,
          spawnDelay: [r2(lo), r2(hi)],
          afterKill, ...first,
          ...(zoneSpawner(item) ? { size: pos(Math.max(0, item.zone.w), 0, Math.max(0, item.zone.d)), rotationY: r2(tFacing + ZONE_TURN_SIGN * rad(zoneTurn(item))) } : {}),
        });
        continue;
      }
      const turnTaker = oneByOne && !bot.trigger && !(bot.move === "patrol" && !(bot.flash && bot.flash.on)) && bot.move !== "copycat";
      if (!turnTaker && usesOwnDispatcher(item)) {
        ownDispatchers.push(randomSpotDispatcher(item, n, drill, start, ground, floorAt));
        continue;
      }
      const randomPeek = item.move === "peek" && item.peekStrafe === "random";
      if (turnTaker && (botSpots(item).length > 1 || hasZone(item) || randomPeek)) {
        // Taking turns: each of its spots is another way its turn can go; the round still counts it once.
        // With a zone, each spot becomes one hidden point in its zone (new points each Play).
        const spots = hasZone(item)
          ? botSpots(item).map((s) => { const one = spotsWithZones({ ...item, spots: [], x: s.x, y: s.y, z: s.z, ...(s.route ? { route: s.route } : {}) }, start, floorAt); return one[Math.floor(Math.random() * one.length)]; })
          : botSpots(item);
        // A random strafe-or-hold peeker: both ways of each spot share a route group, so the turn
        // counts once and the game picks strafe or hold when its turn comes (aim-dispatch-group).
        const modes = item.move === "peek" ? peekModes(item) : [item.peekStrafe];
        const ways = spots.flatMap((s, g) => modes.map((mode) => ({ s, g, mode })));
        const pick = ways.map(({ s, g, mode }, v) => {
          const sb = withFloors({ ...item, x: s.x, y: s.y, z: s.z, ...(s.route ? { route: s.route } : {}), ...(Number.isFinite(s.peekWidth) ? { peekWidth: s.peekWidth } : {}), peekStrafe: mode }, ground);
          const tid = v ? `${id}-spot${v + 1}` : id;
          const t = botTemplate(sb, drill, tid, itemName(drill, item), start, true);
          doc.actors.push(t);
          const fixedV = typeof sb.facing === "number" && (sb.move === "still" || sb.move === "strafe");
          const route = { templateId: tid, streak: [1, 1] };
          if (modes.length > 1) route.group = `${id}:${g}`;
          if (sb.move === "still" || sb.move === "strafe") Object.assign(route, { at: pos(sb.x, sb.y, sb.z), rotationY: r2((fixedV ? rad(sb.facing) : yawTo(sb, start)) + Math.PI) });
          if (fixedV) route.fixed = true;
          if (sb.move === "still") route.point = true;
          return route;
        });
        if (round.goal === "clear") {
          // Every bot must show up exactly once, so its spot is picked here (a new pick each time
          // the drill is compiled, i.e. each Play from the Studio). The other actors stay unused.
          routes.push(pick[Math.floor(Math.random() * pick.length)]);
        } else routes.push(...pick); // score rounds: each spot is one more turn it can take
        turnBots += 1;
        continue;
      }
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
        turnBots += 1;
      } else {
        // A little above the floor: the game drops the bot onto whatever is there (a box, a step).
        doc.spawners.push({
          id: `spawner-${n}`, name: itemName(drill, item), kind: "area", actorTemplateId: id, position: pos(first.x, first.y + 0.3, first.z),
          // A copycat's height comes from its recording (jumps, stairs), not from the floor.
          size: pos(0, 0, 0), rotationY: r2(facing), faceTarget: !fixed, groundSnap: !run, maxAlive: 1,
          // A zone: a random point in a w x d area (local x across your view, z toward you) each time,
          // at least 3 degrees (from your start) away from the last one.
          ...(zoneSpawner(item) ? { size: pos(Math.max(0, item.zone.w), 0, Math.max(0, item.zone.d)), minAngularGapFromPrevious: 3, rotationY: r2(facing + ZONE_TURN_SIGN * rad(zoneTurn(item))) } : {}),
          spawnDelay: [r2(Math.max(0.05, item.delay || 0)), r2(Math.max(0.05, item.delay || 0))],
          // The game patch (studio-trigger-line in BiMsX6Xn.js) holds the spawn until you cross a-b.
          ...(bot.trigger ? { trigger: { a: { x: r2(bot.trigger.a.x), z: r2(bot.trigger.a.z) }, b: { x: r2(bot.trigger.b.x), z: r2(bot.trigger.b.z) } } } : {}),
        });
      }
    }
  }
  if (routes.length) {
    const clear = round.goal === "clear";
    doc.dispatchers = [{
      id: "dispatcher-1", name: "One at a time", routes,
      order: round.order === "inOrder" ? "sequence" : "shuffle",
      maxAlive: Math.max(1, Math.min(turnBots, Math.round(round.atOnce || 1))),
      interval: [r2(round.gap ?? 1), r2((round.gap ?? 1) + 0.5)],
      // One setting for all bots that take turns: they face you unless one has a fixed direction.
      faceTarget: !routes.some((r) => r.fixed),
      ...(clear ? { total: turnBots } : {}),
    }];
    for (const r of routes) delete r.fixed;
  }
  if (ownDispatchers.length) {
    doc.dispatchers = [...(doc.dispatchers || []), ...ownDispatchers.map((o) => o.dispatcher)];
    for (const o of ownDispatchers) doc.actors.push(...o.actors);
  }
  // Lobby category: Scenarios (timed clears), Fundamentals (range), Angle holding (bots
  // that shoot back on a map) or Pre-aim.
  const type = round.goal === "clear" ? "moment" : !onMap ? "basic" : drill.items.some((i) => i.kind === "bot" && i.shoots !== "off") ? "hold" : "aim";
  return { doc, type };
}


// One bot with random spots and/or a random wait: one actor per spot, and a dispatcher that sends
// one at a time, a random spot each time (never the same twice in a row), after a random gap.
// A peeker does one peek per appearance and hides; the gap is its time behind cover.
// trade: { afterKill, delay } for a bot that trades: one appearance per kill of that bot, never by itself.
// A trigger line: nothing shows up until you cross it (then its Shows-up delay, then as usual).
function randomSpotDispatcher(item, n, drill, start, ground, floorAt, trade = null) {
  const clear = drill.round.goal === "clear";
  const name = itemName(drill, item);
  const trigger = !trade && item.trigger;
  if (trade) item = { ...item, back: false, trigger: null };
  const actors = [], routes = [];
  // A peeker that strafes or holds at random: two actors per spot (strafes / holds) in one route group, so
  // the game picks the spot as before (never the same twice in a row), then strafe or hold 50/50.
  const modes = item.move === "peek" ? peekModes(item) : [item.peekStrafe];
  let v = 0;
  spotsWithZones(item, start, floorAt).forEach((s, g) => modes.forEach((mode) => {
    const bot = withFloors({ ...item, x: s.x, y: s.y, z: s.z, ...(s.route ? { route: s.route } : {}), ...(Number.isFinite(s.peekWidth) ? { peekWidth: s.peekWidth } : {}), peekStrafe: mode }, ground);
    const id = `actor-${n}${v ? `-spot${v + 1}` : ""}`;
    v += 1;
    actors.push(botTemplate(bot, drill, id, name, start, true));
    const route = { templateId: id, streak: [1, 1] };
    if (modes.length > 1) route.group = g;
    if (bot.move === "still" || bot.move === "strafe") {
      const fixed = typeof bot.facing === "number";
      Object.assign(route, { at: pos(bot.x, bot.y, bot.z), rotationY: r2((fixed ? rad(bot.facing) : yawTo(bot, start)) + Math.PI) });
    }
    if (bot.move === "still") route.point = true;
    // A copycat starts at the first frame of its run from this spot.
    const run = bot.move === "copycat" ? actors[actors.length - 1].behaviors.find((b) => b.kind === "replay") : null;
    // The game only sends routes it knows (cross, strafe or point); the replay then moves it.
    if (run) Object.assign(route, { at: pos(run.frames[0], run.frames[1], run.frames[2]), point: true });
    routes.push(route);
  }));
  const peek = item.move === "peek";
  const lo = peek ? Math.max(0.2, item.coverWait ?? 1) : Math.max(0.2, item.backAfter ?? 1.5);
  const extra = peek ? Math.max(0, Math.min(10, item.randomWait || 0)) : 0.3;
  const dispatcher = {
    id: `dispatcher-${n}`, name, routes,
    order: new Set(routes.map((r, i) => r.group ?? `r${i}`)).size > 1 ? "random" : "sequence",
    maxAlive: 1,
    interval: [r2(lo), r2(lo + extra)],
    faceTarget: !(typeof item.facing === "number" && (item.move === "still" || item.move === "strafe")),
  };
  // A peeker's gap above is its time behind cover; after a kill it waits its own "back after" instead
  // (game patch aim-dispatch-kill-wait in BiMsX6Xn.js).
  if (peek && item.back !== false && !clear) {
    const back = Math.max(0.2, item.backAfter ?? 1.5);
    dispatcher.killDelay = [r2(back), r2(back + 0.3)];
  }
  if (trade) {
    // studio trades (aim-dispatch-gates): the kill of the traded bot brings it, delay later, once per kill.
    Object.assign(dispatcher, { afterKill: trade.afterKill, spawnDelay: trade.delay, ...(trade.first || {}) });
    return { dispatcher, actors };
  }
  // A copycat runs from the round start (after its Shows-up delay), like one without spots;
  // after that its gap is Comes back after (aim-dispatch-gates, firstDelay).
  if (item.move === "copycat" && !trigger) {
    const d = r2(Math.max(0.05, item.delay || 0));
    dispatcher.firstDelay = [d, d];
  }
  if (trigger) {
    // Waits for you to cross the line (aim-dispatch-gates), then shows up after its delay.
    const d = r2(Math.max(0.05, item.delay || 0));
    Object.assign(dispatcher, { trigger: { a: { x: r2(trigger.a.x), z: r2(trigger.a.z) }, b: { x: r2(trigger.b.x), z: r2(trigger.b.z) } }, spawnDelay: [d, d] });
  }
  // Shows up once: "Clear them all", or a bot set not to come back after it dies.
  if (clear || item.back === false) dispatcher.total = 1;
  return { dispatcher, actors };
}

function withFloors(bot, ground) {
  const b = { ...bot, y: ground(bot.x, bot.z, bot.y) };
  if (bot.route) b.route = bot.route.map((p) => ({ ...p, y: ground(p.x, p.z, p.y) }));
  return b;
}
