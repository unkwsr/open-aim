// peek-facing-v1 (19 Nov 2026): a Studio peeker can face a direction you pick. A spawner already keeps its
// rotationY when faceTarget is off, but a dispatcher (bots taking turns, random spots / strafe-or-hold) only
// copied a route's rotationY onto bots that don't walk a route (`wl(C)||XN(y,E,a)`). Now a walking route that
// carries its own rotationY gets it too. The Studio sets rotationY on a walking route only for a peeker with a
// fixed direction, so every other drill is unchanged.
// Usage: node tools/patch-peek-facing.cjs   (patches both app/site copies of BiMsX6Xn.js; safe to run twice)
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "BiMsX6Xn.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "BiMsX6Xn.js")];
const OLD = "wl(C)||XN(y,E,a)";
const NEW = "/* aim-peek-facing */(wl(C)&&E.rotationY===void 0)||XN(y,E,a)";
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("aim-peek-facing")) { console.log("already patched", f); continue; }
  const n = s.split(OLD).length - 1;
  if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}`);
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log("patched", f);
}
