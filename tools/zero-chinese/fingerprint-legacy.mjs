// Builds app/site/aim-legacy/legacy-fingerprints.json from the ORIGINAL legacy value file (10 Nov 2026).
//   node tools/zero-chinese/fingerprint-legacy.mjs <path to original zh-legacy-values.json>
// The original (kept in backups/legacy-fingerprints-2026-11-10/aim-legacy/) lists the old Chinese values found in
// saves, records and Studio drills. The game only ever needs to RECOGNISE those values, never to show them, so the
// shipped file stores a fingerprint of each one instead of the text. data-labels.mjs fingerprints the value it is
// given the same way and looks that up. This script and its output contain no Chinese.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint } from "../../app/site/aim-ui/fingerprint.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = process.argv[2];
if (!source) throw new Error("Pass the original zh-legacy-values.json");
const L = JSON.parse(fs.readFileSync(source, "utf8"));

// distinct old values must get distinct fingerprints inside one table
const table = (entries, where) => {
  const out = {};
  for (const [text, id] of entries) {
    const fp = fingerprint(text);
    if (fp in out) throw new Error(`fingerprint clash in ${where}`);
    out[fp] = id;
  }
  return out;
};
const out = {
  about: "LEGACY COMPATIBILITY. Fingerprints (app/site/aim-ui/fingerprint.mjs) of the original values that existing saves, records and Studio drills contain, each mapped to a stable id of app/site/aim-ui/scene-ids.json. The values themselves are not stored. Read only by app/site/aim-ui/data-labels.mjs. Built by tools/zero-chinese/fingerprint-legacy.mjs.",
  version: 2,
  actorIds: Object.fromEntries(Object.entries(L.actorIds).map(([scene, names]) => [scene, table(Object.entries(names), "actorIds." + scene)])),
  // field -> fingerprint of the default label older Studio versions wrote for it
  tunableDefaults: Object.fromEntries(Object.entries(L.tunableDefaults).map(([field, text]) => [field, fingerprint(text)])),
  botKinds: table(Object.entries(L.botKinds), "botKinds"),
  agents: table(Object.entries(L.agents), "agents"),
  places: table(Object.entries(L.places), "places"),
  // a name that starts with `prefix` (that many characters), then a number, then any number of `copySuffix`
  template: {
    prefixLength: L.template.prefix.length, prefix: fingerprint(L.template.prefix),
    copySuffixLength: L.template.copySuffix.length, copySuffix: fingerprint(L.template.copySuffix),
  },
  // difficulty word (that many characters) at the start of an old title, then one separator character
  difficultyPrefix: {
    about: "Old record / scene names start with a difficulty word and a separator; see data-labels.mjs difficultyPrefix().",
    labels: Object.entries(L.difficultyPrefix.labels).map(([word, id]) => ({ length: word.length, word: fingerprint(word), id })),
    separators: [...L.difficultyPrefix.separators].map((c) => fingerprint(c)),
  },
};
if (new Set(out.difficultyPrefix.labels.map((l) => l.word)).size !== out.difficultyPrefix.labels.length) throw new Error("fingerprint clash in difficulty words");
const file = path.join(here, "../../app/site/aim-legacy/legacy-fingerprints.json");
fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
let n = Object.values(out.actorIds).reduce((a, m) => a + Object.keys(m).length, 0);
n += Object.keys(out.tunableDefaults).length + Object.keys(out.botKinds).length + Object.keys(out.agents).length + Object.keys(out.places).length + 2 + out.difficultyPrefix.labels.length + out.difficultyPrefix.separators.length;
console.log(`${file}: ${n} fingerprints`);
