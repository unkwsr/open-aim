// waves-unstick-v1 (17 Nov 2026): a wave group can never get stuck on trades. On top of patch-studio-waves.cjs .. -v4.
// Patches both copies of CnrSARj_.js. Run once: node tools/patch-studio-waves-v5.cjs
// Found by previews/bot-motion/waves-fuzz.mjs: 56 of 300 random drills never ended, because every bot left in the
// group was a trade waiting for a kill that could not come (two bots trading each other with "Also there" off on
// both, or a partner outside the group that was dead for good).
// Each tick while a group is being played: if nothing of the group is alive, nothing is still to come by time, and
// every bot left waits for a kill (no kill on its way, no kill it hasn't used, its partner not alive), one of them
// comes now, as if it were "Also there": the first that hasn't come yet in this group (else the first). The rest then
// trade as set up. s.came (ids that came in this step) is kept by the appearance count below.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "CnrSARj_.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "CnrSARj_.js")];
const MARK = "waves-unstick-v1";
const edits = [
  // step start: nobody came yet
  ["s.first=new Set(s.plans[k].bots.filter(b=>b.first).map(b=>b.d))/*waves-trade-start-v1*/;",
   `s.first=new Set(s.plans[k].bots.filter(b=>b.first).map(b=>b.d))/*waves-trade-start-v1*/;s.came=new Set/*${MARK}*/;`],
  // each appearance: remember who came
  ["if(h.wave&&V.length&&__aimWv){const W=__aimWv,L=",
   `if(h.wave&&V.length&&__aimWv){__aimWv.came&&__aimWv.came.add(h.id)/*${MARK}*/;const W=__aimWv,L=`],
  // the safety net, right after the wave controller's tick
  ["/*studio-waves-v1*/__aimWv&&__aimWavesTick(__aimWv,x.elapsed,iA,n,A.rules,U,u8,()=>{nD&&(Cg=e.magazineSize,LA=-1)});",
   `/*studio-waves-v1*/__aimWv&&__aimWavesTick(__aimWv,x.elapsed,iA,n,A.rules,U,u8,()=>{nD&&(Cg=e.magazineSize,LA=-1)});` +
   `if(__aimWv&&!__aimWv.over&&__aimWv.phase==="live"&&!__aimWv.pending.length&&__aimWv.armed.size&&!iA.some(o=>o.alive&&__aimWv.ids.has(o.spawnerId))){const W=__aimWv;let fresh=null,any=null,stuck=!0;for(const h of hg){if(!W.armed.has(h.id))continue;const Z=Kg.get(h.id);if(!h.afterKill||!Z||Z.killWait!=null||iA.some(o=>o.alive&&h.afterKill.includes(o.templateId))||iA.some(o=>h.afterKill.includes(o.templateId)&&o.killedTick!==void 0&&o.killedTick>Z.killSeen)){stuck=!1;break}any||(any=Z);fresh||W.came&&W.came.has(h.id)||(fresh=Z)}const P=fresh||any;stuck&&P&&(P.killWait=x.elapsed)}/*${MARK}*/`],
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("already patched:", f); continue; }
  if (!s.includes("waves-trade-start-v1")) throw new Error(`${f}: run patch-studio-waves.cjs .. -v4 first`);
  for (const [from, to] of edits) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}: ${from.slice(0, 60)}`);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(f, s);
  console.log("patched:", f);
}
