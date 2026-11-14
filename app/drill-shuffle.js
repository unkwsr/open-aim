// Per-start shuffle for lobby drills made from Creator drills (creator-to-lobby-v1, tools/export-studio-drills.mjs).
// Such a scene carries scene.aimShuffle = { groups: [{ actors, keepLook?, keepWeapon?, crouchable? }], crouch? }:
// one group per bot (all its actor templates). Each time main.js serves the scene (every Start Training), every
// group gets a random agent (no repeats until all agents are used; flashers keep theirs), a Phantom or Vandal
// (snipers keep theirs), and `crouch` random crouchable groups crouch (the rest stand). Which spots are used each
// round is the game's own rules.spawnerPick (per round, from the round seed). The sceneHash is left as it is, so
// records stay the same drill.
"use strict";

const AGENTS = ["phoenix", "astra", "breach", "brimstone", "chamber", "clove", "cypher", "deadlock", "fade", "gekko", "harbor",
  "iso", "jett", "kayo", "killjoy", "miks", "neon", "omen", "raze", "reyna", "sage", "skye", "sova", "tejo", "veto", "viper",
  "vyse", "waylay", "yoru"];
const RIFLES = ["vandal", "phantom"];
// jett-only-v1: every shuffled bot is Jett (one agent model for all Creator-made drills); flashers keep theirs.
const DRILL_AGENTS = ["jett"];

const shuffle = (list, rnd) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// fixed-drill-models-v1: with a `fixedKey` (the drill's code), agents and Phantom/Vandal come from a random
// generator seeded by that key, so every Start of the same drill gets the same bot models (no new models to load
// mid-round). Crouching still comes from `rnd` (new each Start; it loads nothing).
const seeded = (key) => {
  let h = 2166136261;
  for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

function shuffleScene(scene, rnd = Math.random, fixedKey = null) {
  const cfg = scene && scene.aimShuffle;
  const pick = fixedKey ? seeded("drill-models:" + fixedKey) : rnd;
  if (!cfg || !Array.isArray(cfg.groups)) return scene;
  let doc;
  try { doc = typeof scene.doc === "string" ? JSON.parse(scene.doc) : JSON.parse(JSON.stringify(scene.doc)); } catch { return scene; }
  const byId = new Map((doc.actors || []).map((a) => [a.id, a]));
  // fewer-agents-v1: each drill draws its bots from DRILL_AGENTS only (was: every agent, up to 29 models
  // in one drill), so fewer bot models are loaded and drawn. Flashers (keepLook) keep their own agent.
  const pool = DRILL_AGENTS;
  let bag = [];
  const nextAgent = () => { if (!bag.length) bag = shuffle(pool, pick); return bag.pop(); };
  const crouchers = new Set(shuffle(cfg.groups.filter((g) => g.crouchable), rnd).slice(0, Math.max(0, cfg.crouch | 0)));
  for (const g of cfg.groups) {
    const look = g.keepLook ? null : nextAgent();
    const weapon = g.keepWeapon ? null : RIFLES[Math.floor(pick() * RIFLES.length)];
    for (const id of g.actors) {
      const a = byId.get(id);
      if (!a || !a.body) continue;
      if (look) { if (look === "phoenix") delete a.body.look; else a.body.look = look; }
      if (weapon) a.body.weapon = weapon;
      if (g.crouchable && typeof cfg.crouch === "number") { if (crouchers.has(g)) a.body.motion = "crouch"; else if (a.body.motion === "crouch") delete a.body.motion; }
    }
  }
  const { aimShuffle, ...rest } = scene;
  const text = JSON.stringify(doc);
  return { ...rest, doc: typeof scene.doc === "string" ? text : doc, docBytes: Buffer.byteLength(text) };
}

module.exports = { shuffleScene, AGENTS, RIFLES };
