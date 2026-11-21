// turns-repeat-v1 (21 Nov 2026): player report "One by one, random with 2 bots: the one I just killed never comes
// again, it's always the other one". The dispatcher's random orders never pick the route that just played
// (shuffle deals each once and keeps the last one off the front; random skips the current one), so 2 bots always
// alternate. A dispatcher with `repeat: true` now picks any available route at random, the just-killed one too
// (fair: each of N bots 1/N). Only the Studio sets `repeat` (drill.js, bots taking turns), so lobby drills are unchanged.
// Usage: node tools/patch-turns-repeat.cjs   (patches both app/site copies of BiMsX6Xn.js; safe to run twice)
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "BiMsX6Xn.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "BiMsX6Xn.js")];
const OLD = 'const r=e.length;let s;if(n.order==="sequence")';
const NEW = 'const r=e.length;let s;if(n.repeat===true&&n.order!=="sequence")/* aim-turns-repeat */s=e[Math.floor(i.next()*r)];else if(n.order==="sequence")';
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("aim-turns-repeat")) { console.log("already patched", f); continue; }
  const n = s.split(OLD).length - 1;
  if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}`);
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log("patched", f);
}
