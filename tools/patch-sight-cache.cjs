// sight-cache-v1 (19 Nov 2026): when bots can shoot, every live bot asks "can I see the player?" every sim tick
// (~18 checks per tick on Hard-Haven Mid to Garage, 91 % blocked by a wall) and each check is a full BVH raycast
// (Al, ~8 us blocked / ~17 us visible) = ~40 % of the sim's time with bots shooting (0.40 vs 0.12 ms per tick).
// A hidden bot is nearly always blocked by the same wall triangle as on the last tick, so the sight ray is first
// tested against the last 32 triangles that blocked a sight ray (per collision mesh). The triangle test is an exact
// copy of Al's leaf test (same epsilons, same skip range, no facing filter); a hit closer than Al's early-exit
// distance means Al would also report a hit closer than it, so the yes/no answer is the same. Otherwise Al runs as
// before. Only the bot sight check (tE in CnrSARj_) uses this; bullets, flashes and movement call Al unchanged.
//   node tools/patch-sight-cache.cjs        patches both copies of BiMsX6Xn.js and CnrSARj_.js
const fs = require('fs'), path = require('path');
const HELPER = `/* sight-cache-v1 */const __aimSightRings=new WeakMap(),__aimSightHit={t:0,nx:0,ny:0,nz:0,tri:-1};function __aimSightTri(n,J,e,t,i,r,s,a){let P=0,q=n;if(n.parts){q=null;for(const U of n.parts){if(J<P+U.count){q=U;break}P+=U.count}if(!q)return-1}const y=q.tris,se=(J-P)*9,oe=y[se],pe=y[se+1],X=y[se+2],ie=y[se+3]-oe,$=y[se+4]-pe,ce=y[se+5]-X,Ee=y[se+6]-oe,fe=y[se+7]-pe,ke=y[se+8]-X,we=s*ke-a*fe,Le=a*Ee-r*ke,Ue=r*fe-s*Ee,He=ie*we+$*Le+ce*Ue;if(He>-1e-12&&He<1e-12)return-1;const nt=1/He,rt=e-oe,it=t-pe,st=i-X,et=(rt*we+it*Le+st*Ue)*nt;if(et<0||et>1)return-1;const at=it*ce-st*$,k=st*ie-rt*ce,Dt=rt*$-it*ie,Ge=(r*at+s*k+a*Dt)*nt;if(Ge<0||et+Ge>1)return-1;return(Ee*at+fe*k+ke*Dt)*nt}function __aimSightRay(n,e,t,i,r,s,a,o,c,l,u,f){if(n.count===0)return null;let g=__aimSightRings.get(n);if(!g){g={ids:new Int32Array(32).fill(-1),next:0};__aimSightRings.set(n,g)}if(c===-1/0&&l>-1/0)for(let k=0;k<32;k++){const J=g.ids[k];if(J<0||J>=u&&J<f)continue;const L=__aimSightTri(n,J,e,t,i,r,s,a);if(L>1e-7&&L<o&&L<l){__aimSightHit.t=L;__aimSightHit.tri=J;return __aimSightHit}}const h=Al(n,e,t,i,r,s,a,o,c,l,u,f);if(h&&h.t<l){let seen=!1;for(let k=0;k<32;k++)if(g.ids[k]===h.tri){seen=!0;break}if(!seen){g.ids[g.next]=h.tri;g.next=g.next+1&31}}return h}function Vx(n=64){`;
const EDITS = {
  'BiMsX6Xn.js': [['function Vx(n=64){', HELPER]],
  'CnrSARj_.js': [['wD(t.projectile,c.x,c.y,c.z,x/j,v/j,QA/j,j,-1/0,b,t.sightSkip.from,t.sightSkip.to)', '__aimSightRay(t.projectile,c.x,c.y,c.z,x/j,v/j,QA/j,j,-1/0,b,t.sightSkip.from,t.sightSkip.to)']],
};
const PREFIX = { 'BiMsX6Xn.js': '', 'CnrSARj_.js': 'import{__aimSightRay}from"./BiMsX6Xn.js";\n' };
const SUFFIX = { 'BiMsX6Xn.js': '\nexport{__aimSightRay};\n', 'CnrSARj_.js': '' };
function transform(name, s) {
  if (s.includes('sight-cache-v1') || s.includes('import{__aimSightRay}')) return s;
  for (const [a, b] of EDITS[name]) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`${name}: expected 1 match, got ${n}: ${a.slice(0, 70)}`); s = s.replace(a, () => b); }
  return PREFIX[name] + s + SUFFIX[name];
}
module.exports = { transform };
if (require.main === module) for (const dir of ['app/site/next/js', 'app/site/_assets/r20261021-1/next/js']) for (const name of Object.keys(EDITS)) {
  const p = path.join(__dirname, '..', dir, name); fs.writeFileSync(p, transform(name, fs.readFileSync(p, 'utf8'))); console.log('patched', p);
}
