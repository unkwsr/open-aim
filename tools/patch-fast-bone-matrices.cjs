// fast-bone-matrices-v1 (19 Nov 2026): each bot's skeleton stage (117 bones + gun) had its world matrices updated by
// three's generic recursive Object3D.updateMatrixWorld every frame - ~140-230 us per frame with 20 bots (2340 bones).
// The stage now walks a flat pre-order list of its subtree doing exactly what Object3D.updateMatrixWorld does for each
// node (same updateMatrix / multiplyMatrices calls, same force / matrixWorldNeedsUpdate / matrixAutoUpdate /
// matrixWorldAutoUpdate rules). Any node with its own updateMatrixWorld (SkinnedMesh, ...) is called as before and its
// subtree is left to it. The list is rebuilt when a child is added to / removed from any node in it.
// Measured live (20 bots): scene matrix update 135-304 us -> 61-114 us per frame; bones / guns / every other node
// bit-identical to the generic update on the same inputs (body meshes' animated scale differs between two generic runs
// as well - not from this).
//   node tools/patch-fast-bone-matrices.cjs        patches both copies of CnrSARj_.js
const fs = require('fs'), path = require('path');
const HELPER = `/* fast-bone-matrices-v1 */function aimFastStageMatrices(model){const stage=model.skin?.stage;if(!stage||Object.prototype.hasOwnProperty.call(stage,'updateMatrixWorld'))return;const BASE=Object.getPrototypeOf(stage).updateMatrixWorld;let nodes=null,par=null,cus=null,F=null;const dirty=()=>{nodes=null};const build=()=>{nodes=[];par=[];cus=[];const rec=(o,pi)=>{const i=nodes.length;nodes.push(o);par.push(pi);const c=o.updateMatrixWorld!==BASE;cus.push(c);o.addEventListener('childadded',dirty);o.addEventListener('childremoved',dirty);if(!c)for(const ch of o.children)rec(ch,i)};stage.addEventListener('childadded',dirty);stage.addEventListener('childremoved',dirty);for(const ch of stage.children)rec(ch,-1);F=new Uint8Array(nodes.length)};stage.updateMatrixWorld=function(force){if(nodes===null)build();this.matrixAutoUpdate&&this.updateMatrix();if(this.matrixWorldNeedsUpdate||force){this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,force=!0}const N=nodes,P=par,K=cus,G=F;for(let i=0;i<N.length;i++){const n=N[i],p=P[i],f=p<0?force:G[p]===1;if(K[i]){n.updateMatrixWorld(f);G[i]=1;continue}n.matrixAutoUpdate&&n.updateMatrix();let nf=f;if(n.matrixWorldNeedsUpdate||f){n.matrixWorldAutoUpdate===!0&&(n.parent===null?n.matrixWorld.copy(n.matrix):n.matrixWorld.multiplyMatrices(n.parent.matrixWorld,n.matrix)),n.matrixWorldNeedsUpdate=!1,nf=!0}G[i]=nf?1:0}}}function aimCacheStaticSkeleton(model){`;
const EDITS = [
  ['function aimCacheStaticSkeleton(model){', HELPER],
  ['aimCacheStaticSkeleton(u),u}', 'aimCacheStaticSkeleton(u),aimFastStageMatrices(u),u}'],
];
function transform(s) {
  if (s.includes('fast-bone-matrices-v1')) return s;
  for (const [a, b] of EDITS) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${a.slice(0, 60)}`); s = s.replace(a, () => b); }
  return s;
}
module.exports = { transform };
if (require.main === module) for (const dir of ['app/site/next/js', 'app/site/_assets/r20261021-1/next/js']) {
  const p = path.join(__dirname, '..', dir, 'CnrSARj_.js'); fs.writeFileSync(p, transform(fs.readFileSync(p, 'utf8'))); console.log('patched', p);
}
