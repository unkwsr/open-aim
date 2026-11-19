// waves-groups-v1 (17 Nov 2026): game side of the reworked Studio waves (waves with groups, app/studio/drill.js).
// On top of studio-waves-v1 (tools/patch-studio-waves.cjs). Patches both copies of CnrSARj_.js. Run once:
//   node tools/patch-studio-waves-v2.cjs
// Two per-step fields, both optional (old drills don't have them and play exactly as before):
//   plan.gap    - pause before THIS step, in s (used when steps play in order). Overrides waves.gap.
//   plan.refill - false = no HP / magazine refill when this step starts (a wave's 2nd, 3rd... group).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "CnrSARj_.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "CnrSARj_.js")];
const MARK = "waves-groups-v1";

const edits = [
  ["s.armed.clear();if(s.i>1){w.hp&&heal(",
   `s.armed.clear();if(s.i>1&&s.plans[k].refill!==!1/*${MARK}*/){w.hp&&heal(`],
  ["const g=Array.isArray(w.gap)?w.gap:[+w.gap||0,+w.gap||0]",
   `const __nx=w.order==="sequence"?s.plans[(s.last+1)%s.plans.length]:null/*${MARK}*/,g=__nx&&typeof __nx.gap==="number"?[__nx.gap,__nx.gap]:Array.isArray(w.gap)?w.gap:[+w.gap||0,+w.gap||0]`],
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("already patched:", f); continue; }
  if (!s.includes("studio-waves-v1")) throw new Error(`${f}: run tools/patch-studio-waves.cjs first`);
  for (const [from, to] of edits) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}: ${from.slice(0, 60)}`);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(f, s);
  console.log("patched:", f);
}
