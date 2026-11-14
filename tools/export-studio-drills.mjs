// Creator drills -> official lobby drills (VALORANT Training), marker creator-to-lobby-v1.
//   node tools/export-studio-drills.mjs            write scenarios/creator-*.json (then run scripts/build-scenarios.mjs)
//   node tools/export-studio-drills.mjs --dry      only print what each drill becomes
// Source: the Creator drills of the Worker Test profile (test-data/worker-test/AimTrainer/studio-drills); SRC=<dir> for another.
// Rules (user, 13 Nov 2026):
//  - Bots don't come back after they die, unless the drill has trades (then everything stays as made) or has
//    only one bot (hold drills against one enemy keep respawning).
//  - Every enemy gets a random agent each time the drill starts, except flashers (their flash belongs to their agent).
//  - Every enemy holds a Phantom or Vandal (random), except snipers (Operator, Tour de Force, Marshal, Outlaw).
//  - Pre-aim drills (10+ bots, no trades): each round uses about 2/3 of the placed spots, a new random set every round
//    (the game's rules.spawnerPick, picked from the round seed); flashers are always there. Holders crouch at random,
//    about 5-6 of the bots in play.
// The per-start part (agents, guns, crouch) is done by app/drill-shuffle.js from scene.aimShuffle when main.js serves
// the drill. The Creator drills themselves are not changed.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(ROOT, "previews/bot-motion/env.mjs")).href); // browser stand-ins + game import paths
const realFetch = globalThis.fetch;
const MAPS = ["ascent", "bonsai", "duality", "foxtrot", "infinity", "jam", "juliett", "pitt", "plummet", "port", "range", "rook", "triad"];
globalThis.fetch = async (u, ...a) => (typeof u === "string" && u.startsWith("/local-api/maps") ? new Response(JSON.stringify({ maps: MAPS.map((id) => ({ id })) })) : realFetch(u, ...a));
const D = await import(pathToFileURL(path.join(ROOT, "app/studio/drill.js")).href);
const { p: gameCheck } = await import("/_assets/r20261021-1/next/js/D_iGclxB.js");

const SRC = process.env.SRC || path.join(ROOT, "test-data/worker-test/AimTrainer/studio-drills");
const OUT = path.join(ROOT, "scenarios");
const DRY = process.argv.includes("--dry");
const SNIPERS = new Set(["operator", "tourdeforce", "marshal", "outlaw"]);
const PRE_AIM_BOTS = 10, KEEP_SHARE = 2 / 3, CROUCH_IN_PLAY = 5.5;
const MAP_NAME = { ascent: "Ascent", bonsai: "Split", duality: "Bind", foxtrot: "Breeze", infinity: "Abyss", jam: "Lotus", juliett: "Sunset", pitt: "Pearl", plummet: "Summit", port: "Icebox", rook: "Corrode", triad: "Haven", range: "Range" };

const hex16 = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const report = [];
let written = 0;
// studio-autoexport-v1: ONLY=<Creator code>[,<code>] exports just those drills (main.js runs this when the Creator saves one).
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)) : null;
// lobby-hidden-v1: Creator drills the player took off the main page (<userData>/lobby-hidden.json) are not exported.
let HIDDEN = new Set();
try { HIDDEN = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "..", "lobby-hidden.json"), "utf8"))); } catch {}
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith(".json") && !HIDDEN.has(f.slice(0, -5)) && (!ONLY || ONLY.has(f.slice(0, -5).toLowerCase()))).sort()) {
  const saved = JSON.parse(fs.readFileSync(path.join(SRC, file), "utf8"));
  const drill = JSON.parse(JSON.stringify(saved.drill));
  const bots = drill.items.filter((i) => i.kind === "bot");
  if (!bots.length) { report.push(`skip ${drill.name}: no bots`); continue; }
  const trades = bots.some((b) => b.tradeOf);
  const single = bots.length === 1;
  const preAim = !trades && bots.length >= PRE_AIM_BOTS;
  if (!trades && !single) for (const b of bots) b.back = false;

  const { doc, type } = D.compile(drill, null);
  try { gameCheck(JSON.stringify(doc)); } catch (err) { report.push(`FAIL ${drill.name}: game check: ${err.message}`); continue; }

  // Which bot each actor template belongs to ("Holder 3", "Holder 3 ..." for its spot variants).
  const named = bots.map((b) => [D.itemName(drill, b), b]).sort((a, b) => b[0].length - a[0].length);
  const botOf = (actor) => (named.find(([n]) => actor.name === n || (actor.name || "").startsWith(n + " ") || (actor.name || "").startsWith(n + "·")) || [])[1];
  const groups = new Map(); // bot id -> { actors, keepLook, keepWeapon, crouchable }
  let unmatched = 0;
  for (const a of doc.actors) {
    if (!a.body || a.body.shape !== "humanoid") continue;
    const b = botOf(a);
    if (!b) { unmatched++; continue; }
    const g = groups.get(b.id) || { actors: [], keepLook: !!(b.flash && b.flash.on), keepWeapon: SNIPERS.has(b.weapon), crouchable: preAim && b.move === "still" && !(b.flash && b.flash.on) && !b.crouchRandom, pool: false };
    g.actors.push(a.id);
    groups.set(b.id, g);
  }
  if (unmatched) { report.push(`FAIL ${drill.name}: ${unmatched} actors not matched to a bot`); continue; }

  // Bots taking turns share one "one at a time" queue that never runs out; like the Creator's "Clear them all",
  // it gets one turn per bot, so a bot that died doesn't get another turn.
  let turnLimit = 0;
  if (!trades && !single) for (const disp of doc.dispatchers || []) {
    const owners = new Set(disp.routes.map((r) => { const a = doc.actors.find((x) => x.id === r.templateId); const b = a && botOf(a); return b ? b.id : r.templateId; }));
    if (owners.size > 1 && disp.total === undefined) {
      disp.total = owners.size; turnLimit = owners.size;
      // One choice per bot (its spots are versions of that choice, aim-dispatch-group), so no bot gets two turns.
      for (const r of disp.routes) { const a = doc.actors.find((x) => x.id === r.templateId); const b = a && botOf(a); if (b && r.group === undefined) r.group = "bot-" + b.id; }
    }
  }
  // Pre-aim: a random 2/3 of the single-spot bots every round; flashers always there.
  let pick = null;
  if (preAim) {
    const pool = doc.spawners.filter((s) => { const a = doc.actors.find((x) => x.id === s.actorTemplateId); const b = a && botOf(a); return b && !(b.flash && b.flash.on); }).map((s) => s.id);
    if (doc.rules.spawnerPick) report.push(`note ${drill.name}: already had a spawner pick, replaced`);
    if (pool.length >= 4) {
      pick = { pool, count: Math.max(1, Math.round(pool.length * KEEP_SHARE)) };
      doc.rules.spawnerPick = pick;
      for (const id of pool) { const a = doc.actors.find((x) => x.id === doc.spawners.find((s) => s.id === id).actorTemplateId); const g = groups.get(botOf(a).id); g.pool = true; }
    }
  }
  const list = [...groups.values()];
  const crouchable = list.filter((g) => g.crouchable).length;
  const inPlay = pick ? (pick.count + list.filter((g) => !g.pool).length) / list.length : 1;
  // Never more than half the holders, so which ones crouch really changes.
  const crouch = preAim ? Math.min(Math.ceil(crouchable / 2), Math.round(CROUCH_IN_PLAY / Math.max(0.1, inPlay))) : null;
  try { gameCheck(JSON.stringify(doc)); } catch (err) { report.push(`FAIL ${drill.name}: game check after pick: ${err.message}`); continue; }

  const code = hex16(`creator-to-lobby:${saved.item.shareCode}`);
  const text = JSON.stringify(doc);
  const shoots = bots.some((b) => b.shoots && b.shoots !== "off");
  const parts = [];
  if (pick) parts.push(`${pick.count} of ${pick.pool.length} spots each round, new spots every round.`);
  else if (trades) parts.push("Trades: kill one and the next swings in.");
  else if (single) parts.push("One enemy, comes back after each kill.");
  else parts.push(`${bots.length} bots, each one once.`);
  parts.push(shoots ? "Bots shoot back." : "Bots don't shoot.");
  const note = (drill.note || "").trim();
  const description = (note ? note.replace(/\s+/g, " ").slice(0, 160) + " " : "") + parts.join(" ");
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const name = drill.name.trim();
  const item = {
    createTime: saved.item.createTime || now, description, docBytes: Buffer.byteLength(text), featured: false,
    mapId: drill.place === "range" ? null : drill.place, name, parSeconds: doc.rules.moment ? doc.rules.moment.parSeconds : null,
    playCount: 0, sceneKey: `set-${code}`, shareCode: code, sort: 1, status: 1, type, updateTime: now,
  };
  const scene = {
    authorNickname: "openVaim", authorUid: "creator", blockCount: doc.blocks.length, createTime: item.createTime, description,
    docBytes: item.docBytes, name, playCount: 0, sceneHash: hex16(text), sceneKey: item.sceneKey, schemaVersion: 2,
    shareCode: code, updateTime: now,
    // creator-to-lobby-v1: what app/drill-shuffle.js changes each time the drill starts.
    aimShuffle: { groups: list.map((g) => ({ actors: g.actors, ...(g.keepLook ? { keepLook: true } : {}), ...(g.keepWeapon ? { keepWeapon: true } : {}), ...(g.crouchable ? { crouchable: true } : {}) })), ...(crouch !== null ? { crouch } : {}) },
    doc,
  };
  let out = `creator-${slug(MAP_NAME[drill.place] || drill.place)}-${slug(name.replace(new RegExp(`^${MAP_NAME[drill.place] || "x"}\\b`, "i"), ""))}.json`;
  // Two Creator drills with the same name would get the same file and one would overwrite the other: keep both.
  try { const there = JSON.parse(fs.readFileSync(path.join(OUT, out), "utf8")); if (there.item.shareCode !== code) out = out.replace(/\.json$/, `-${code.slice(0, 6)}.json`); } catch {}
  report.push(`ok   ${out.padEnd(58)} ${String(bots.length).padStart(2)} bots${trades ? ", trades as made" : single ? ", 1 bot respawns" : ", no respawn"}${pick ? `, ${pick.count}/${pick.pool.length} spots per round` : ""}${turnLimit ? `, ${turnLimit} turns` : ""}${crouch !== null ? `, crouch ${crouch} of ${crouchable}` : ""}, keep agent ${list.filter((g) => g.keepLook).length}, keep sniper ${list.filter((g) => g.keepWeapon).length}`);
  if (!DRY) {
    // drill-rename-v1: a renamed drill gets a new file name; drop its old file (same code) so the build has no duplicate.
    for (const f of fs.readdirSync(OUT).filter((f) => f.startsWith("creator-") && f.endsWith(".json") && f !== out)) {
      try { if (JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")).item.shareCode === code) { fs.rmSync(path.join(OUT, f)); report.push(`     replaced old file ${f}`); } } catch {}
    }
    fs.writeFileSync(path.join(OUT, out), JSON.stringify({ item, scene }, null, 1)); written++;
  }
}
console.log(report.join("\n"));
console.log(DRY ? "(dry run, nothing written)" : `${written} files written to scenarios/. Now run: node scripts/build-scenarios.mjs`);
