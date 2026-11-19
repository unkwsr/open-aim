// waves-end-v1 (17 Nov 2026): "After the last wave: Round ends" really ends the round. On top of
// patch-studio-waves.cjs .. -v6. Patches both copies of CnrSARj_.js. Run once: node tools/patch-studio-waves-v7.cjs
// doc.waves.endRound (app/studio/drill.js, set when "Start again" is off): once the last wave is over and none of
// its bots is alive, the round is done (targetsExhausted), even if bots that are in no wave would keep coming back
// (measured before: a timed wave drill with one such bot ran until the timer).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "CnrSARj_.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "CnrSARj_.js")];
const MARK = "waves-end-v1";
const from = "targetsExhausted(){if(pg.length===0&&hg.length===0)return!1;";
const to = `targetsExhausted(){if(pg.length===0&&hg.length===0)return!1;if(__aimWv&&__aimWv.w.endRound&&__aimWv.over&&!iA.some(o=>o.alive&&hg.some(h=>h.wave&&h.id===o.spawnerId)))return!0/*${MARK}*/;`;
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("already patched:", f); continue; }
  if (!s.includes("wave-hud-v1")) throw new Error(`${f}: run patch-studio-waves.cjs .. -v6 first`);
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}`);
  s = s.replace(from, () => to);
  fs.writeFileSync(f, s);
  console.log("patched:", f);
}
