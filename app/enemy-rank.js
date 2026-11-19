// Enemy rank per drill (marker enemy-rank-v1). The lobby's drill cards let you pick how well the bots shoot
// back: "off" (they don't shoot) or Iron to Radiant. main.js keeps the picks in <userData>/enemy-ranks.json and
// applies one when the game asks for that drill's scene (SCENE_PREFIX), so it works the same in Worker Test and
// the normal launcher. The scene's sceneHash gets "-r<rank>" added, so the game keeps separate records per rank.
//
// Rank numbers are the Creator's table (app/studio/drill.js RANKS / shooter()); keep the two the same.
"use strict";

const RANKS = [
  ["off", "Don't shoot", null, "#8b909a"],
  ["iron", "Iron", { reaction: [0.9, 1.1], error: 9, heads: false }, "#8d8d8d"],
  ["bronze", "Bronze", { reaction: [0.75, 0.9], error: 7, heads: false }, "#c08552"],
  ["silver", "Silver", { reaction: [0.6, 0.75], error: 5.5, heads: false }, "#c9d2d6"],
  ["gold", "Gold", { reaction: [0.5, 0.62], error: 4.5, heads: false }, "#e8b84a"],
  ["platinum", "Platinum", { reaction: [0.42, 0.52], error: 3.5, heads: true }, "#3fb6c8"],
  ["diamond", "Diamond", { reaction: [0.34, 0.44], error: 2.8, heads: true }, "#c07fe6"],
  ["ascendant", "Ascendant", { reaction: [0.28, 0.36], error: 2.2, heads: true }, "#3fc07a"],
  ["immortal", "Immortal", { reaction: [0.22, 0.3], error: 1.6, heads: true }, "#e0475e"],
  ["radiant", "Radiant", { reaction: [0.17, 0.23], error: 1.1, heads: true }, "#ffe08a"],
];
const IDS = RANKS.map((r) => r[0]);
const isRank = (id) => IDS.includes(id);

const parseDoc = (scene) => (typeof scene.doc === "string" ? JSON.parse(scene.doc) : scene.doc);
// Bots = the humanoid actors. Drills without any (target spheres on the range) get no rank picker.
const bots = (doc) => (Array.isArray(doc && doc.actors) ? doc.actors.filter((a) => a && a.body && a.body.shape === "humanoid") : []);

// The rank a drill has as it was made: the most common rank among its shooting bots, matched by reaction time
// (and head aim); "off" when no bot shoots.
function defaultRank(doc) {
  const counts = new Map();
  for (const a of bots(doc)) for (const b of a.behaviors || []) {
    if (!b || b.kind !== "shooter") continue;
    const mid = Array.isArray(b.reaction) ? (b.reaction[0] + b.reaction[1]) / 2 : 0.5;
    const heads = b.difficulty === "hard";
    let best = null, bestD = Infinity;
    for (const [id, , r] of RANKS) {
      if (!r) continue;
      const d = Math.abs((r.reaction[0] + r.reaction[1]) / 2 - mid) + (r.heads === heads ? 0 : 0.03);
      if (d < bestD) { bestD = d; best = id; }
    }
    counts.set(best, (counts.get(best) || 0) + 1);
  }
  let pick = "off", n = 0;
  for (const [id, c] of counts) if (c > n || (c === n && IDS.indexOf(id) > IDS.indexOf(pick))) { pick = id; n = c; }
  return pick;
}

function shooter(id, old) {
  const r = RANKS.find((x) => x[0] === id)[2];
  return {
    kind: "shooter", difficulty: r.heads ? "hard" : "easy", reaction: [...r.reaction], cadence: "weapon",
    aimErrorDeg: r.error, maxRangeM: (old && old.maxRangeM) || 80, engage: (old && old.engage) || "stop",
    resumeDelay: (old && Array.isArray(old.resumeDelay) && old.resumeDelay) || [0.4, 0.8],
  };
}

// Every bot gets the rank's shooting ("off": none). Other behaviors are kept as they are.
function applyRank(doc, id) {
  const out = JSON.parse(JSON.stringify(doc));
  for (const a of bots(out)) {
    const list = a.behaviors || (a.behaviors = []);
    const at = list.findIndex((b) => b && b.kind === "shooter");
    const old = at >= 0 ? list[at] : null;
    if (at >= 0) list.splice(at, 1);
    if (id !== "off") list.splice(at >= 0 ? at : list.length, 0, shooter(id, old));
  }
  return out;
}

// Info for the lobby card: can it have a rank, which one it has now, and which one it was made with.
function info(scene, picked) {
  try {
    const doc = parseDoc(scene);
    if (!bots(doc).length) return { eligible: false };
    const made = defaultRank(doc);
    return { eligible: true, made, rank: isRank(picked) ? picked : made };
  } catch {
    return { eligible: false };
  }
}

// rank-rules-v1 (user, 14 Nov 2026): when the bots shoot back, they can kill you (the round ends when you die);
// at Immortal and Radiant you also get your HP back on every kill. "Don't shoot" keeps the drill's own rules.
// Hold-site drills (name has "hold" or the lobby type is "hold", 4-5 bots on a map) get the HP refill from Diamond up (user, 14 Nov 2026).
const HEAL_FROM = "immortal", HEAL_FROM_HOLD_SITE = "diamond";
// Call with the scene as stored (before drill-shuffle.js removes aimShuffle): bots = Creator bots, or humanoid actors.
function isHoldSite(scene, type) {
  try {
    if (!/hold/i.test(scene.name || "") && type !== "hold") return false;
    const doc = parseDoc(scene);
    if (!doc.environment || !doc.environment.map || doc.environment.map === "range") return false;
    const n = scene.aimShuffle && Array.isArray(scene.aimShuffle.groups) ? scene.aimShuffle.groups.length : bots(doc).length;
    return n >= 4 && n <= 5;
  } catch { return false; }
}
const healFrom = (scene, type) => (isHoldSite(scene, type) ? HEAL_FROM_HOLD_SITE : HEAL_FROM);
function rankRules(doc, id, holdSite, ownDrill = false) {
  if (id === "off") return false;
  // rules-split-v1 (17 Nov 2026, user: "separate this so these issues stop happening"). Two kinds of drill, two
  // rule sets, never mixed:
  //  - YOUR OWN Creator drill (played from the Creator / your own drills): its own settings ONLY. "Bots can kill me",
  //    "Refill HP when I kill a bot" and "HP per kill" are exactly what you set; the rank never touches them.
  //  - Every other drill (main page, Workshop, the game's own): the RANK decides. Bots that shoot can kill you; HP
  //    refill (full) only from Immortal (Diamond on hold sites), never below, whatever the drill file says.
  // (Replaces studio-heal-keep-v1 / studio-death-keep-v1 / lobby-death-fix-v1, which mixed the two.)
  if (ownDrill) return false;
  const rules = doc.rules || (doc.rules = {});
  const heal = IDS.indexOf(id) >= IDS.indexOf(holdSite ? HEAL_FROM_HOLD_SITE : HEAL_FROM);
  const before = JSON.stringify([rules.playerDeath, rules.healOnKill, rules.healAmount]);
  rules.playerDeath = "endRound";
  if (heal) rules.healOnKill = true; else delete rules.healOnKill;
  delete rules.healAmount; // main-page refill is always full HP
  return JSON.stringify([rules.playerDeath, rules.healOnKill, rules.healAmount]) !== before;
}

// The scene sent to the game: the picked rank's shooting (if it differs from how the drill was made) and the
// rank's rules (rankRules). The sceneHash only changes with the shooting, so records stay per rank as before.
function sceneWithRank(scene, picked, holdSite = isHoldSite(scene), ownDrill = false) {
  if (!scene) return scene;
  let doc;
  try { doc = parseDoc(scene); } catch { return scene; }
  if (!bots(doc).length) return scene;
  const made = defaultRank(doc);
  const id = isRank(picked) ? picked : made;
  const next = id === made ? JSON.parse(JSON.stringify(doc)) : applyRank(doc, id);
  if (!rankRules(next, id, holdSite, ownDrill) && id === made) return scene;
  const text = JSON.stringify(next);
  return {
    ...scene,
    doc: typeof scene.doc === "string" ? text : next,
    docBytes: Buffer.byteLength(text),
    ...(id === made ? {} : { sceneHash: `${scene.sceneHash || "scene"}-r${id}` }),
  };
}

module.exports = { RANKS, IDS, isRank, defaultRank, applyRank, rankRules, isHoldSite, healFrom, info, sceneWithRank };
