// waves-trade-start-v1 (17 Nov 2026): "Also there when its group starts" + repeat trades inside Studio waves.
// On top of patch-studio-waves.cjs, -v2, -v3. Patches both copies of CnrSARj_.js. Run once:
//   node tools/patch-studio-waves-v4.cjs
// plan bot fields (app/studio/drill.js waveComing): first (a trading bot comes when its group starts, then only as a
// trade), n (appearances in this group in all, default 1). dispatcher.tradeD = the partner's dispatcher.
//  - step start: left[d] = n; a "first" bot's kill gate opens at once (killWait = now).
//  - each appearance counts down; at 0 it is disarmed (before: disarmed after its first appearance).
//  - an armed trade whose partner can't bring it anymore (partner in this group, not armed / pending / alive, no
//    kill it hasn't used, itself not alive, no trade on its way) is disarmed, so the group can end.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "CnrSARj_.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "CnrSARj_.js")];
const MARK = "waves-trade-start-v1";

const edits = [
  ["s.fresh=new Map(s.plans[k].bots.map(b=>[b.d,!!b.free]))/*waves-trades-v1*/;",
   `s.fresh=new Map(s.plans[k].bots.map(b=>[b.d,!!b.free]))/*waves-trades-v1*/;s.left=new Map(s.plans[k].bots.map(b=>[b.d,Math.max(1,Math.floor(+b.n||1))]));s.first=new Set(s.plans[k].bots.filter(b=>b.first).map(b=>b.d))/*${MARK}*/;`],
  ["if(h.afterKill){Z.killSeen=U;Z.killWait=fr?x.elapsed:null}}/*waves-trades-v1*/if(h.wave&&!(__aimWv&&__aimWv.armed.has(h.id)))continue;",
   `if(h.afterKill){Z.killSeen=U;Z.killWait=fr||__aimWv.first&&__aimWv.first.has(h.id)?x.elapsed:null}}/*waves-trades-v1*/if(h.wave&&!(__aimWv&&__aimWv.armed.has(h.id)))continue;` +
   `if(h.wave&&h.afterKill&&h.tradeD&&__aimWv.ids.has(h.tradeD)&&Z.killWait==null){const W=__aimWv,td=h.tradeD;if(!W.armed.has(td)&&!W.pending.some(b=>b.d===td)&&!iA.some(o=>o.alive&&(o.spawnerId===td||o.spawnerId===h.id))&&!iA.some(o=>h.afterKill.includes(o.templateId)&&o.killedTick!==void 0&&o.killedTick>Z.killSeen)){W.armed.delete(h.id);continue}}/*${MARK}*/`],
  ["h.wave&&V.length&&__aimWv&&__aimWv.armed.delete(h.id);",
   `if(h.wave&&V.length&&__aimWv){const W=__aimWv,L=(W.left&&W.left.has(h.id)?W.left.get(h.id):1)-1;W.left&&W.left.set(h.id,L);L<=0&&W.armed.delete(h.id)}/*${MARK}*/`],
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("already patched:", f); continue; }
  if (!s.includes("waves-trades-v1")) throw new Error(`${f}: run patch-studio-waves.cjs, -v2 and -v3 first`);
  for (const [from, to] of edits) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}: ${from.slice(0, 60)}`);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(f, s);
  console.log("patched:", f);
}
