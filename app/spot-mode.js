// Spot mode: each map drill can be played with "fixed" or "random" bot spots, chosen on its card.
//   fixed : the same spots every time. A drill that draws from a pool (rules.spawnerPick) always uses the first
//           `count` spots of that pool; a drill with fixed spots is left exactly as made.
//   random: the drill's own spots plus every spot other drills on the same map put bots near this route
//           (the "bank", built from the shipped scenarios, so each spot is known to be standable). Each round the
//           game draws the same number of bots as the drill normally has from that bigger pool.
// Only pre-aim drills on a real map take part (hold-site / flash / moment drills depend on exact bot places).
"use strict";

const PAD = 14;      // how far outside the drill's own spots (x/z, game units) extra spots may come from
const MIN_GAP = 2;   // an extra spot closer than this to an existing one is dropped

const docOf = (scene) => { try { return typeof scene.doc === "string" ? JSON.parse(scene.doc) : JSON.parse(JSON.stringify(scene.doc)); } catch { return null; } };

let bank = null; // mapId -> [{x, y, z}]
function buildBank(trainingSet) {
  bank = {};
  for (const item of trainingSet.items || []) {
    if (!item.mapId) continue;
    const scene = trainingSet.scenes[item.shareCode];
    const doc = scene && docOf(scene);
    if (!doc || !Array.isArray(doc.spawners)) continue;
    const list = (bank[item.mapId] = bank[item.mapId] || []);
    const seen = (list.seen = list.seen || new Set());
    for (const sp of doc.spawners) {
      const p = sp.position;
      if (!p) continue;
      const key = `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
      if (!seen.has(key)) { seen.add(key); list.push({ x: p.x, y: p.y, z: p.z }); }
    }
  }
}

function eligible(scene, item) {
  if (!scene || !item || !item.mapId || item.type !== "aim" || scene.aimSets) return null;
  const doc = docOf(scene);
  if (!doc || !Array.isArray(doc.spawners) || doc.spawners.length < 2) return null;
  return doc;
}

const defaultMode = (doc) => (doc.rules && doc.rules.spawnerPick ? "random" : "fixed");

function info(scene, item, chosen) {
  const doc = eligible(scene, item);
  if (!doc) return { eligible: false };
  const def = defaultMode(doc);
  return { eligible: true, mode: chosen === "fixed" || chosen === "random" ? chosen : def, authored: def };
}

function apply(scene, item, chosen, trainingSet) {
  const doc = eligible(scene, item);
  if (!doc) return scene;
  const mode = chosen === "fixed" || chosen === "random" ? chosen : defaultMode(doc);
  const pick = doc.rules.spawnerPick;
  const ownIds = pick ? pick.pool : doc.spawners.map((s) => s.id);
  const count = pick ? pick.count : doc.spawners.length;
  const finish = (spawners, spawnerPick) => {
    doc.spawners = spawners;
    doc.rules = { ...doc.rules, spawnerPick };
    const text = JSON.stringify(doc);
    return { ...scene, doc: typeof scene.doc === "string" ? text : doc, docBytes: Buffer.byteLength(text) };
  };
  if (mode === "fixed") {
    if (!pick) return scene;
    return finish(doc.spawners, { ...pick, pool: pick.pool.slice(0, pick.count) });
  }
  if (!bank) buildBank(trainingSet);
  const own = doc.spawners.filter((s) => ownIds.includes(s.id));
  if (!own.length) return scene;
  const xs = own.map((s) => s.position.x), zs = own.map((s) => s.position.z);
  const box = [Math.min(...xs) - PAD, Math.max(...xs) + PAD, Math.min(...zs) - PAD, Math.max(...zs) + PAD];
  const extra = [];
  for (const p of bank[item.mapId] || []) {
    if (p.x < box[0] || p.x > box[1] || p.z < box[2] || p.z > box[3]) continue;
    if (doc.spawners.some((s) => Math.hypot(s.position.x - p.x, s.position.z - p.z) < MIN_GAP)) continue;
    const tpl = own[extra.length % own.length];
    const id = `rnd-${extra.length + 1}`;
    extra.push({ ...tpl, id, kind: "fixed", position: { x: p.x, y: p.y, z: p.z }, size: { x: 0, y: 0, z: 0 }, name: `Extra spot ${extra.length + 1}` });
  }
  if (!extra.length) return pick ? finish(doc.spawners, pick) : scene;
  return finish([...doc.spawners, ...extra], { pool: [...ownIds, ...extra.map((s) => s.id)], count });
}

module.exports = { info, apply, buildBank };
