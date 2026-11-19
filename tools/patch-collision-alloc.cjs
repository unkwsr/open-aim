// collision-alloc-v1 (19 Nov 2026): the capsule-vs-triangle helpers Jx and Qg (player/bot movement collision, run
// once per nearby triangle, thousands of times per tick) created a new closure on every call (Jx: clamp S; Qg: D,
// which also closed over F/B). That was ~35-40 % of all garbage the sim makes (~346 KB per tick), feeding frequent
// GCs. Same math, no per-call allocation: S -> module function __aimClamp01; D -> __aimQgD writing into __aimQgS.
//   node tools/patch-collision-alloc.cjs        patches both copies of BiMsX6Xn.js
const fs = require('fs'), path = require('path');
function transform(s) {
  if (s.includes('collision-alloc-v1')) return s;
  const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${a.slice(0, 80)}`); s = s.replace(a, () => b); };
  // Jx: body between its header and the next function
  const jxHead = 'S=F=>F<0?0:F>1?1:F;let w,I;const R=1e-12;';
  const jxStart = s.indexOf(jxHead); if (jxStart < 0 || s.indexOf(jxHead, jxStart + 1) >= 0) throw new Error('Jx anchor');
  const jxEnd = s.indexOf('A[0]=w,A[1]=I}', jxStart); if (jxEnd < 0) throw new Error('Jx end');
  let body = s.slice(jxStart, jxEnd);
  const uses = (body.match(/\bS\(/g) || []).length; if (uses !== 5) throw new Error('Jx S uses ' + uses);
  body = body.replace('S=F=>F<0?0:F>1?1:F;', '__aimJxNoClosure=0;').replace(/\bS\(/g, '__aimClamp01(');
  s = s.slice(0, jxStart) + body + s.slice(jxEnd);
  // the comma-declaration "...,b=g*C+p*v+E*y,__aimJxNoClosure=0;" must stay a valid const list: declare the dummy
  rep(',b=g*C+p*v+E*y,__aimJxNoClosure=0;let w,I;', ',b=g*C+p*v+E*y;let w,I;');
  rep('const dn=new Float64Array(8);function Qg(', '/* collision-alloc-v1 */function __aimClamp01(F){return F<0?0:F>1?1:F}const __aimQgS=new Float64Array(2);function __aimQgD(m,P,U,O,G,V,W,J){const se=G-P,oe=V-U,pe=W-O,X=se*se+oe*oe+pe*pe;X<__aimQgS[0]&&(__aimQgS[0]=X,__aimQgS[1]=J,m[0]=P,m[1]=U,m[2]=O,m[3]=G,m[4]=V,m[5]=W)}const dn=new Float64Array(8);function Qg(');
  rep('let F=1/0,B=0;const D=(P,U,O,G,V,W,J)=>{const se=G-P,oe=V-U,pe=W-O,X=se*se+oe*oe+pe*pe;X<F&&(F=X,B=J,m[0]=P,m[1]=U,m[2]=O,m[3]=G,m[4]=V,m[5]=W)};sd(n,e,t,a,o,c,l,u,f,A,h,d,dn),D(dn[0],dn[1],dn[2],n,e,t,dn[3]),sd(i,r,s,a,o,c,l,u,f,A,h,d,dn),D(dn[0],dn[1],dn[2],i,r,s,dn[3]);',
      '__aimQgS[0]=1/0,__aimQgS[1]=0;sd(n,e,t,a,o,c,l,u,f,A,h,d,dn),__aimQgD(m,dn[0],dn[1],dn[2],n,e,t,dn[3]),sd(i,r,s,a,o,c,l,u,f,A,h,d,dn),__aimQgD(m,dn[0],dn[1],dn[2],i,r,s,dn[3]);');
  rep('D(U+(W-U)*pe,O+(J-O)*pe,G+(se-G)*pe,n+g*oe,e+p*oe,t+E*oe,0)}m[6]=F,m[7]=B}', '__aimQgD(m,U+(W-U)*pe,O+(J-O)*pe,G+(se-G)*pe,n+g*oe,e+p*oe,t+E*oe,0)}m[6]=__aimQgS[0],m[7]=__aimQgS[1]}');
  return s;
}
module.exports = { transform };
if (require.main === module) for (const dir of ['app/site/next/js', 'app/site/_assets/r20261021-1/next/js']) {
  const p = path.join(__dirname, '..', dir, 'BiMsX6Xn.js'); fs.writeFileSync(p, transform(fs.readFileSync(p, 'utf8'))); console.log('patched', p);
}
