// studio-waves-v1 (17 Nov 2026): coordinated bot waves for Studio drills.
// Patches both copies of CnrSARj_.js (the game's sim). Run once: node tools/patch-studio-waves.cjs
//
// Scene format (written by app/studio/drill.js compile):
//   doc.waves = { order: "sequence" | "shuffle" | "weighted", first: s, gap: [lo, hi], limit: s (0 = none),
//                 count: n (0 = until the round ends), hp: bool, ammo: bool,
//                 plans: [{ name, weight, bots: [{ d: <dispatcher id>, at: s }] }] }
//   Every bot in a plan is a dispatcher with wave: true. It only sends a bot while its wave arms it (once per wave,
//   `at` seconds after the wave starts). A wave ends when all its bots came and none is alive, or at its time limit
//   (bots still up leave, not counted as kills). Then a gap, then the next plan.
//   With a wave count, the round's "all done" check (targetsExhausted) waits for the last wave.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "CnrSARj_.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "CnrSARj_.js")];
const MARK = "studio-waves-v1";

const helpers = `/*${MARK}*/function __aimWavesInit(w,rng){const plans=(w.plans||[]).filter(p=>p&&Array.isArray(p.bots)&&p.bots.length);return{w,plans,rng,phase:"gap",nextAt:Math.max(0,+w.first||0),i:0,last:-1,startAt:0,pending:[],ids:new Set,armed:new Set,bag:[],over:plans.length===0}}function __aimWavesPick(s){const P=s.plans,N=P.length;if(N===1)return 0;const o=s.w.order;if(o==="sequence")return(s.last+1)%N;if(o==="weighted"){const wt=p=>Math.max(0,+p.weight||0);let t=0;for(const p of P)t+=wt(p);if(t<=0)return Math.floor(s.rng.next()*N);let r=s.rng.next()*t;for(let k=0;k<N;k++){r-=wt(P[k]);if(r<0)return k}return N-1}if(!s.bag.length){s.bag=P.map((_,k)=>k);for(let k=N-1;k>0;k--){const j=Math.floor(s.rng.next()*(k+1));[s.bag[k],s.bag[j]]=[s.bag[j],s.bag[k]]}if(s.bag[0]===s.last){const j=1+Math.floor(s.rng.next()*(N-1));[s.bag[0],s.bag[j]]=[s.bag[j],s.bag[0]]}}return s.bag.shift()}function __aimWavesTick(s,t,actors,player,rules,tick,heal,ammo){if(s.over)return;const w=s.w,count=Math.max(0,Math.floor(+w.count||0));if(s.phase==="gap"){if(t<s.nextAt)return;const k=__aimWavesPick(s);s.last=k;s.i+=1;s.phase="live";s.startAt=t;s.pending=s.plans[k].bots.map(b=>({d:b.d,at:Math.max(0,+b.at||0)}));s.ids=new Set(s.pending.map(b=>b.d));s.armed.clear();if(s.i>1){w.hp&&heal(player,{...rules,healAmount:void 0});w.ammo&&ammo()}}for(let k=s.pending.length-1;k>=0;k--){const b=s.pending[k];t>=s.startAt+b.at&&(s.armed.add(b.d),s.pending.splice(k,1))}const lim=+w.limit||0;let done=!1;if(lim>0&&t>=s.startAt+lim){for(const o of actors)o.alive&&s.ids.has(o.spawnerId)&&(o.alive=!1,o.visible=!1,o.expiredTick=tick,delete o.leaveAt);done=!0}else done=!s.pending.length&&!s.armed.size&&!actors.some(o=>o.alive&&s.ids.has(o.spawnerId));if(!done)return;s.armed.clear();s.pending=[];s.phase="gap";if(count&&s.i>=count){s.over=!0;return}const g=Array.isArray(w.gap)?w.gap:[+w.gap||0,+w.gap||0],lo=Math.max(0,+g[0]||0),hi=Math.max(lo,+g[1]||0);s.nextAt=t+(hi>lo?s.rng.range(lo,hi):lo)}`;

const edits = [
  // Controller state, made with the round (one per sim).
  ["const IE=new Set(hg.map(c=>c.id))",
   `const __aimWv=/*${MARK}*/A.waves&&Array.isArray(A.waves.plans)?__aimWavesInit(A.waves,Ug.fork(57005)):null;const IE=new Set(hg.map(c=>c.id))`],
  // Each tick: run the controller, then only armed wave dispatchers may send their bot.
  ["for(const h of hg){const Z=Kg.get(h.id),fA=tD.get(h.id);if(!Z||!fA)continue;",
   `/*${MARK}*/__aimWv&&__aimWavesTick(__aimWv,x.elapsed,iA,n,A.rules,U,u8,()=>{nD&&(Cg=e.magazineSize,LA=-1)});for(const h of hg){const Z=Kg.get(h.id),fA=tD.get(h.id);if(!Z||!fA)continue;if(h.wave&&!(__aimWv&&__aimWv.armed.has(h.id)))continue;`],
  ["pickRng:fA.pick,timeRng:fA.time,nextId:()=>++MD});",
   "pickRng:fA.pick,timeRng:fA.time,nextId:()=>++MD});h.wave&&V.length&&__aimWv&&__aimWv.armed.delete(h.id);"],
  // Round "all done": wave bots are done once the last wave is over and none of them is alive.
  ["G=hg.some(x=>{if(tp(x,Kg.get(x.id)))return!0;",
   `G=hg.some(x=>{if(x.wave)return __aimWv?!__aimWv.over||iA.some(o=>o.alive&&o.spawnerId===x.id):!1;if(tp(x,Kg.get(x.id)))return!0;`],
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("already patched:", f); continue; }
  for (const [from, to] of edits) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}: ${from.slice(0, 60)}`);
    s = s.replace(from, () => to);
  }
  // Helpers go right after the import lines (before the model pack's top-level await).
  const at = s.indexOf("/*aim-model-pack*/");
  if (at < 0) throw new Error(`${f}: no aim-model-pack marker`);
  s = s.slice(0, at) + helpers + "\n" + s.slice(at);
  fs.writeFileSync(f, s);
  console.log("patched:", f);
}
