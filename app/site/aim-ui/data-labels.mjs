// Display labels for scene / drill DATA (batch 68 onward; ID-based since batch 77). Read-only: callers pass the
// original value (and, when they have them, its stable ids) and get a string to SHOW. Nothing here mutates a scene
// document, tunable object, save, record, id or hash, and nothing falls back to a generic translator.
//
// Stable ids (app/mods/aim-ui/scene-ids.json, generated, English only):
//   scene  = the scene document's meta.id (catalog sceneKey); records carry shareCode, mapped through `shareCodes`
//   actor  = the document's actors[].id (the engine reports it as kill.actor / killer.actor; new run records store
//            it as killedById)
//   tunable = rules.tunables[].field
//   callout = minimap callouts[].id (the minimap assets are English themselves)
// Old values: saves, records and Studio drills made by older versions hold ORIGINAL names without ids. They are
// resolved to ids through app/mods/aim-legacy/legacy-fingerprints.json, which stores a fingerprint of each original
// value (fingerprint.mjs) instead of the value: the game only has to recognise an old value, never to show it
// (10 Nov 2026; the earlier zh-legacy-values.json held the values themselves). Unknown / author-written text is
// returned unchanged; text with CJK characters that resolves to nothing is recorded in `missingDataLabels` for audits.
import IDS from "./scene-ids.json" with { type: "json" };
import LEGACY from "../aim-legacy/legacy-fingerprints.json" with { type: "json" };
import { fingerprint } from "./fingerprint.mjs";

const ch = (n) => String.fromCharCode(n);
const CJK = new RegExp(`[${ch(0x3400)}-${ch(0x9fff)}]`);

export const SCENE_IDS = IDS;
// Read-only view ({ field: { en } }), kept for the older checks. The original-language text is no longer stored.
export const TUNABLE_LABELS = Object.freeze(Object.fromEntries(Object.entries(IDS.tunableDefaults).map(([f, en]) => [f, Object.freeze({ en })])));
export const missingDataLabels = new Map(); // "kind:key" -> original text, for audits (never shown to players)

function note(kind, key, text) {
  const id = `${kind}:${key}`;
  if (!missingDataLabels.has(id)) missingDataLabels.set(id, text);
}

// scene key from whatever the caller has: { scene } (meta.id / sceneKey) or { shareCode }
export function sceneKeyOf(ref) {
  if (!ref) return null;
  if (typeof ref.scene === "string" && IDS.scenes[ref.scene]) return ref.scene;
  if (typeof ref.shareCode === "string" && IDS.shareCodes[ref.shareCode]) return IDS.shareCodes[ref.shareCode];
  return null;
}

// ---- tunables (Parameters rows)
// `tunable` is the scene's own tunable object (not modified); `ctx` optionally { scene | shareCode }.
export function tunableLabel(tunable, ctx) {
  const label = typeof tunable?.label === "string" ? tunable.label : "";
  if (!CJK.test(label)) return label;
  const field = tunable.field;
  const key = sceneKeyOf(ctx);
  const byScene = key ? IDS.scenes[key].tunables?.[field] : undefined;
  if (byScene) return byScene;
  // old value: the built-in default label the Studio used to write for this field -> the field's English default
  if (typeof LEGACY.tunableDefaults[field] === "string" && fingerprint(label.trim()) === LEGACY.tunableDefaults[field] && IDS.tunableDefaults[field]) return IDS.tunableDefaults[field];
  note("tunable", field ?? "?", label);
  return label;
}

// ---- actors (bot names)
const normBot = (s) => s.trim().replace(/\s+/g, " ").replace(/[‘’']/g, "").replace(/bot/gi, "bot").replace(/^A/, "a");

// true when `rest` is empty or nothing but repetitions of the old copy suffix
function onlyCopies(rest, t) {
  if (rest.length % t.copySuffixLength) return false;
  for (let i = 0; i < rest.length; i += t.copySuffixLength) if (fingerprint(rest.slice(i, i + t.copySuffixLength)) !== t.copySuffix) return false;
  return true;
}

// Resolve an OLD actor name with no id (old Studio drills, unknown scenes): legacy default-name rules -> ids -> English.
function legacyGenericName(name) {
  const key = normBot(name);
  const kind = LEGACY.botKinds[fingerprint(key)];
  if (kind && IDS.botKinds[kind]) return IDS.botKinds[kind];
  // "<template word><number>" followed by any number of " <copy word>" (the names the old editor gave new bots)
  const t = LEGACY.template;
  if (key.length >= t.prefixLength && fingerprint(key.slice(0, t.prefixLength)) === t.prefix) {
    const m = /^(\d+)(.*)$/.exec(key.slice(t.prefixLength));
    if (m && onlyCopies(m[2], t)) return IDS.templateLabel.replace("{n}", m[1]);
  }
  const m = /^(.+?)(\d+(?:\.\d+)?)?$/.exec(key);
  if (m) {
    const word = fingerprint(m[1]);
    const agent = LEGACY.agents[word];
    if (agent && IDS.agents[agent]) return m[2] ? `${IDS.agents[agent]} ${m[2]}` : IDS.agents[agent];
    const place = LEGACY.places[word];
    if (place && IDS.places[place] && m[2]) return `${IDS.places[place]} ${m[2]}`;
  }
  return null;
}

// Actor id for an old (scene, name) pair from a record / older engine report.
export function legacyActorId(ref, name) {
  const key = sceneKeyOf(ref);
  return key && typeof name === "string" ? LEGACY.actorIds[key]?.[fingerprint(name)] ?? null : null;
}

// Name to SHOW for a bot. Accepts the stored / reported name (string) or a reference object
// { name, actor, scene | shareCode } (engine kill / killer objects, run records). Nothing is modified.
export function botName(ref) {
  const r = typeof ref === "string" || ref == null ? { name: ref } : ref;
  const name = r.name;
  const key = sceneKeyOf(r);
  const actors = key ? IDS.scenes[key].actors : null;
  // 1. stable ids
  if (actors && typeof r.actor === "string" && actors[r.actor]) {
    // a built-in document is fixed (hashed), so its actor id identifies the original name; if a caller passes a
    // different (author-changed) name for the same id, keep that name
    if (typeof name !== "string" || name === "" || LEGACY.actorIds[key]?.[fingerprint(name)] === r.actor) return actors[r.actor];
  }
  if (typeof name !== "string" || !CJK.test(name)) return name;
  // 2. old value of a built-in scene -> id
  const id = legacyActorId(r, name);
  if (actors && id && actors[id]) return actors[id];
  // 3. old default names written by earlier Studio versions (user drills / Copycat) -> ids
  const generic = legacyGenericName(name);
  if (generic) return generic;
  // 4. user-authored text: shown as written
  note("bot", name, name);
  return name;
}

// ---- difficulty-prefixed titles (batch 94)
// Old record / scene names start with a difficulty word and a separator ("<easy>-<title>"). The words and separators
// are old values in the legacy file (difficultyPrefix, as fingerprints); they resolve to these ids. Same pattern the
// parser vt() (BPUvDycd) always used: trimmed, word, then optional spaces around one separator or plain spaces, then
// the title. It used to be one regular expression (word, then spaces / one separator / spaces or just spaces, then
// the title to the end of the line); oldPrefix() below gives the same answers without the words being written out.
export const DIFFICULTY = Object.freeze({
  easy: Object.freeze({ label: "Easy", level: 1 }),
  medium: Object.freeze({ label: "Medium", level: 2 }),
  hard: Object.freeze({ label: "Hard", level: 3 }),
});
const DP = LEGACY.difficultyPrefix;
const SEPARATORS = new Set(DP.separators);
const isSpace = (c) => /\s/.test(c);
const LINE_END = new RegExp("[" + ch(10) + ch(13) + ch(0x2028) + ch(0x2029) + "]"); // what "." never matches
const titleOk = (t) => t.length > 0 && !LINE_END.test(t);
// The part after the difficulty word: spaces, one separator, spaces (or just spaces), then the title. Tries the
// longest run of spaces first and gives characters back one at a time, exactly as the regular expression did.
function titleAfter(rest) {
  let spaces = 0;
  while (spaces < rest.length && isSpace(rest[spaces])) spaces++;
  for (let at = spaces; at >= 0; at--) {
    if (at >= rest.length || !SEPARATORS.has(fingerprint(rest[at]))) continue;
    let end = at + 1;
    while (end < rest.length && isSpace(rest[end])) end++;
    for (let from = end; from > at; from--) if (titleOk(rest.slice(from))) return rest.slice(from);
  }
  for (let from = spaces; from >= 1; from--) if (titleOk(rest.slice(from))) return rest.slice(from);
  return null;
}
// { id, title } for a trimmed old name that starts with a difficulty word, otherwise null.
function oldPrefix(name) {
  for (const label of DP.labels) {
    if (name.length <= label.length || fingerprint(name.slice(0, label.length)) !== label.word) continue;
    const title = titleAfter(name.slice(label.length));
    if (title !== null) return { id: label.id, title };
  }
  return null;
}
// English prefixes ("Hard-<title>") used by the map drills imported from the installed app (7 Nov 2026). Only with a
// "-" right after the word, so ordinary titles that start with "Hard" or "Easy" are not split.
const EN_DIFF_RE = /^(Easy|Medium|Hard)-(\S.*)$/;

// { title, id, label, level } for a difficulty-prefixed name, otherwise null. Nothing is modified.
export function difficultyPrefix(name) {
  if (typeof name !== "string") return null;
  const en = EN_DIFF_RE.exec(name.trim());
  if (en) {
    const id = en[1].toLowerCase();
    return { title: en[2], id, label: DIFFICULTY[id].label, level: DIFFICULTY[id].level };
  }
  const old = oldPrefix(name.trim());
  const d = old ? DIFFICULTY[old.id] : undefined;
  return d ? { title: old.title, id: old.id, label: d.label, level: d.level } : null;
}

// Task / run name to SHOW in Training history. Old prefixed names read "Easy-<title>" (the form the screen showed
// through the translator); every other name is returned unchanged (author-written text stays as written).
export function runTitle(name) {
  const p = difficultyPrefix(name);
  return p ? `${p.label}-${p.title}` : name;
}

if (typeof globalThis !== "undefined") globalThis.__aimMissingDataLabels = missingDataLabels;
