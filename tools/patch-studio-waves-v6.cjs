// wave-hud-v1 (17 Nov 2026): the sim snapshot carries the Studio wave state for the HUD's wave counter
// (app/site/local/wave-hud.mjs). On top of patch-studio-waves.cjs .. -v5. Patches both copies of CnrSARj_.js.
// Run once: node tools/patch-studio-waves-v6.cjs
// snapshot.waves = { phase: "gap" | "live" | "done", next: s until the next step (gap), wave, waves, group, groups,
//   play, plays (1-based, from the plan fields w / g / gs / pl / pls written by app/studio/drill.js), round: how many
//   times all waves were played through (with "Start again from the first wave"), first: true before the first wave }.
// Only drills with Studio waves have it. Cost: one small object per snapshot.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "CnrSARj_.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "CnrSARj_.js")];
const MARK = "wave-hud-v1";
const helper = `/*${MARK}*/function __aimWavesSnap(s,t){const P=s.plans,N=P.length;if(!N)return null;const live=s.phase==="live",k=live||s.over?Math.max(0,s.last):s.w.order==="sequence"?(s.last+1)%N:Math.max(0,s.last),p=P[k]||{};return{phase:s.over?"done":s.phase,next:!live&&!s.over?Math.max(0,Math.round((s.nextAt-t)*10)/10):0,wave:p.w||1,waves:s.w.total||1,group:p.g||1,groups:p.gs||1,play:p.pl||1,plays:p.pls||1,round:Math.floor(Math.max(0,s.i-1)/N)+1,first:s.i===0}}`;
const edits = [
  ["snapshot(){return{tick:U,airWall:r,rope:Pw,",
   `snapshot(){return{tick:U,airWall:r,rope:Pw,...__aimWv?{waves:__aimWavesSnap(__aimWv,U*AA)}:{}/*${MARK}*/,`],
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("already patched:", f); continue; }
  if (!s.includes("waves-unstick-v1")) throw new Error(`${f}: run patch-studio-waves.cjs .. -v5 first`);
  for (const [from, to] of edits) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}: ${from.slice(0, 60)}`);
    s = s.replace(from, () => to);
  }
  const at = s.indexOf("/*aim-model-pack*/");
  if (at < 0) throw new Error(`${f}: no aim-model-pack marker`);
  s = s.slice(0, at) + helper + "\n" + s.slice(at);
  fs.writeFileSync(f, s);
  console.log("patched:", f);
}
