// Studio trades (7 Nov 2026): two small patches to the game bundles, safe to run again.
//  1. CnrSARj_.js (simulation): a bot killed by you gets killedTick = the tick it died (a peeker that
//     just hides behind cover does not), so spawners can tell a kill from a vanish.
//  2. BiMsX6Xn.js (spawners): a spawner with afterKill: [templateId, ...] spawns only after one of
//     those bots is killed, spawnDelay later, once per kill (studio-trade-kill).
// Usage: node tools/patch-trades.cjs   (patches app/site/next/js and app/site/_assets/r20261021-1/next/js)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "app", "site");
const DIRS = ["next/js", "_assets/r20261021-1/next/js"];
const KILL_FROM = 'z.alive=!1,fB(z),c.push({tick:U,kind:"kill"';
const KILL_TO = 'z.alive=!1,z.killedTick=U,fB(z),c.push({tick:U,kind:"kill"';
const SPAWN_AT = "/*studio-trigger-line*/";
const SPAWN_ADD = "if(e.afterKill){const K=e.afterKill;if(t.killSeen===void 0)t.killSeen=-1,t.killWait=null;" +
  "if(r.some(o2=>o2.spawnerId===e.id&&o2.alive))return[];" +
  "if(t.killWait===null){let k=-1;for(const o2 of r)if(K.includes(o2.templateId)&&o2.killedTick!==void 0&&o2.killedTick>t.killSeen&&o2.killedTick>k)k=o2.killedTick;" +
  "if(k<0)return[];t.killSeen=k;t.killWait=s.elapsed+a.range(e.spawnDelay[0],e.spawnDelay[1])}" +
  "if(s.elapsed<t.killWait)return[];t.killWait=null;t.nextSpawnAt=s.elapsed;" +
  // Dead copies from earlier trades still count against maxAlive (Ch(): a bot with a respawn/cross
  // behaviour keeps its slot), so they leave this spawner before the next one swings.
  "for(const o2 of r)o2.spawnerId===e.id&&!o2.alive&&(o2.spawnerId=e.id+'#traded')}/*studio-trade-kill*/";
for (const dir of DIRS) {
  const sim = path.join(ROOT, dir, "CnrSARj_.js");
  let s = fs.readFileSync(sim, "utf8");
  if (s.includes(KILL_TO)) console.log(`${dir}/CnrSARj_.js: already patched`);
  else if (s.split(KILL_FROM).length === 2) { fs.writeFileSync(sim, s.replace(KILL_FROM, KILL_TO)); console.log(`${dir}/CnrSARj_.js: patched`); }
  else throw new Error(`${dir}/CnrSARj_.js: kill site not found exactly once`);
  const sp = path.join(ROOT, dir, "BiMsX6Xn.js");
  s = fs.readFileSync(sp, "utf8");
  if (s.includes("/*studio-trade-kill*/")) console.log(`${dir}/BiMsX6Xn.js: already patched`);
  else if (s.split(SPAWN_AT).length === 2) { fs.writeFileSync(sp, s.replace(SPAWN_AT, SPAWN_AT + SPAWN_ADD)); console.log(`${dir}/BiMsX6Xn.js: patched`); }
  else throw new Error(`${dir}/BiMsX6Xn.js: trigger-line marker not found exactly once`);
}
