// wave-hp-amount-v1 (17 Nov 2026): "Refill HP" at each new wave can add a set amount instead of always full.
// On top of patch-studio-waves.cjs .. -v7. Patches both copies of CnrSARj_.js. Run once:
//   node tools/patch-studio-waves-v8.cjs
// doc.waves.hpAmount (app/studio/drill.js, 10-99; unset = full): the wave refill calls the game's heal (T5 in
// BiMsX6Xn.js, the same as "HP per kill") with that healAmount: +N HP up to 100, armor not refilled. Unset = as
// before (full health + armor).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "CnrSARj_.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "CnrSARj_.js")];
const MARK = "wave-hp-amount-v1";
const from = "w.hp&&heal(player,{...rules,healAmount:void 0})";
const to = `w.hp&&heal(player,{...rules,healAmount:typeof w.hpAmount=="number"&&w.hpAmount>0&&w.hpAmount<100?w.hpAmount:void 0}/*${MARK}*/)`;
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("already patched:", f); continue; }
  if (!s.includes("waves-end-v1")) throw new Error(`${f}: run patch-studio-waves.cjs .. -v7 first`);
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}`);
  s = s.replace(from, () => to);
  fs.writeFileSync(f, s);
  console.log("patched:", f);
}
