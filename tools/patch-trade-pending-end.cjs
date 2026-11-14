const fs = require('fs');
const OLD = 'targetsExhausted(){if(pg.length===0&&hg.length===0)return!1;const c=pg.some(x=>{const v=bA.get(x.actorTemplateId);return v?P8(x,v,iA):!1}),G=hg.some(x=>{const v=Kg.get(x.id);return v?o8(x,v,Fw.get(x.id)??[],iA):!1});return!c&&!G}';
// aim-trade-pending: a trade (afterKill) that is waiting to swing in, or whose bot was killed and not yet answered,
// or whose bot is still alive, can still come, so the round is not "cleared" in the gap between a kill and its trade.
const NEW = 'targetsExhausted(){if(pg.length===0&&hg.length===0)return!1;/*aim-trade-pending*/const tp=(x,t)=>{if(!x.afterKill)return!1;if(!t||t.killSeen===void 0||t.killWait!=null)return!0;return iA.some(o=>x.afterKill.includes(o.templateId)&&(o.alive||o.killedTick!==void 0&&o.killedTick>t.killSeen))};const c=pg.some(x=>{if(tp(x,cD.get(x.id)))return!0;const v=bA.get(x.actorTemplateId);return v?P8(x,v,iA):!1}),G=hg.some(x=>{if(tp(x,Kg.get(x.id)))return!0;const v=Kg.get(x.id);return v?o8(x,v,Fw.get(x.id)??[],iA):!1});return!c&&!G}';
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, 'utf8');
  if (s.includes('/*aim-trade-pending*/')) { console.log('already', f); continue; }
  if (s.split(OLD).length !== 2) throw new Error('target not found once in ' + f);
  fs.writeFileSync(f, s.replace(OLD, NEW)); console.log('patched', f);
}
