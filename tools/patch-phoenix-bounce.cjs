// Phoenix curveball bounces off walls (marker phoenix-bounce-v1). Needs phoenix-real-v1 first.
// Like VALORANT's Projectile_Phoenix_E_FlareCurve_Synced: the flight is precalculated at the throw in 0.042857 s
// steps (PrecalculatedProjectileMovement, 0.6 s); each step is traced against the map's projectile collision; on a
// hit the velocity is bounced with ProjectileBounceComponent Bounciness 0.4 / Friction 0.6 (Unreal's bounce
// formula), it stops under 20 cm/s and pops where it is at 0.6 s. Only a flight that hits something stores a path
// (cross.phP, 15 points); a clear flight keeps the old curve and pops on the star as before.
//   node tools/patch-phoenix-bounce.cjs          patch both copies of BiMsX6Xn.js, CnrSARj_.js, OkAdunfX.js
//   require(...).transform(name, source)         patched text for one file (previews use it)
const fs = require("fs");
const path = require("path");

const HELPERS = `/* phoenix-bounce-v1 */function __aimPhxAt(o,y,r,T,s,p){if(!p||p.length<6)return pm(o,y,r,T,s);const f=Math.max(0,T)/lo.timestep,n=p.length/3-1,i=Math.min(n-1,Math.floor(f)),w=Math.min(1,f-i),a=i*3,b=a+3;return{x:p[a]+(p[b]-p[a])*w,y:p[a+1]+(p[b+1]-p[a+1])*w,z:p[a+2]+(p[b+2]-p[a+2])*w}}
function __aimPhxBounce(c,ray){c.phAt=c.thrownAt;delete c.phP;if(!ray)return;const dt=lo.timestep,N=Math.round((c.detonateAt-c.thrownAt)/dt);if(!(N>0&&N<64))return;const o={x:c.throwX,y:c.throwY,z:c.throwZ},yw=c.throwYaw,rt=c.throwRight!==0,sc=c.throwScale,pts=[o.x,o.y,o.z];let p={x:o.x,y:o.y,z:o.z},v=null,hit=!1;for(let k=1;k<=N;k++){let rem=dt,g=0;const q=v===null?pm(o,yw,rt,k*dt,sc):null;while(rem>1e-6&&g++<4){const dx=v===null?q.x-p.x:v.x*rem,dy=v===null?q.y-p.y:v.y*rem,dz=v===null?q.z-p.z:v.z*rem,L=Math.hypot(dx,dy,dz);if(L<1e-6)break;const h=ray(p,dx/L,dy/L,dz/L,L);if(!h||!(h.t<L)){p={x:p.x+dx,y:p.y+dy,z:p.z+dz};break}const f=Math.max(0,h.t-.01)/L,vi={x:dx/rem,y:dy/rem,z:dz/rem};p={x:p.x+dx*f,y:p.y+dy*f,z:p.z+dz*f},rem*=1-f;let nx=h.nx,ny=h.ny,nz=h.nz,vn=vi.x*nx+vi.y*ny+vi.z*nz;vn>0&&(nx=-nx,ny=-ny,nz=-nz,vn=-vn);const tx=vi.x-nx*vn,ty=vi.y-ny*vn,tz=vi.z-nz*vn;v={x:tx*.4-nx*vn*.4,y:ty*.4-ny*vn*.4,z:tz*.4-nz*vn*.4},hit=!0;if(Math.hypot(v.x,v.y,v.z)<.2){v={x:0,y:0,z:0};break}}if(v!==null){const d=Ef(PS,k*dt/Ii)/Math.max(1e-6,Ef(PS,(k-1)*dt/Ii));v={x:v.x*d,y:v.y*d,z:v.z*d}}pts.push(p.x,p.y,p.z)}if(hit){c.phP=pts.map(x=>Math.round(x*1e4)/1e4),c.boomX=p.x,c.boomY=p.y,c.boomZ=p.z}}
function kS(n,e,t){`;

const EDITS = {
  "BiMsX6Xn.js": [
    ["function kS(n,e,t){", HELPERS],
    ["return{agent:t,origin:{x:e.throwX,y:e.throwY,z:e.throwZ},", "return{path:e.phP??null,agent:t,origin:{x:e.throwX,y:e.throwY,z:e.throwZ},"],
  ],
  "CnrSARj_.js": [
    ["for(const h of iA){const Z=h.behavior.cross;if(!Z||Z.resolved||Z.detonateAt===void 0)continue;const fA=OB(Z.fa);",
     "for(const h of iA){const Z=h.behavior.cross;if(!Z||Z.resolved||Z.detonateAt===void 0)continue;const fA=OB(Z.fa);/* phoenix-bounce-v1 */if(fA===\"phoenix\"&&Z.thrownAt>=0&&Z.phAt!==Z.thrownAt)__aimPhxBounce(Z,t.projectile?(p,dx,dy,dz,L)=>wD(t.projectile,p.x,p.y,p.z,dx,dy,dz,L,-1/0,-1/0,t.sightSkip?.from??0,t.sightSkip?.to??0):null);"],
  ],
  "OkAdunfX.js": [
    ["const P=h=>rt(pc(n.origin,n.yaw,n.right,Math.min(Math.max(h,0),$o),n.scale))", "const P=h=>rt(__aimPhxAt(n.origin,n.yaw,n.right,Math.min(Math.max(h,0),$o),n.scale,n.path))"],
    ["const O=k=>pc(x.origin,x.yaw,x.right,Math.min(Math.max(k,0),$o),x.scale)", "const O=k=>__aimPhxAt(x.origin,x.yaw,x.right,Math.min(Math.max(k,0),$o),x.scale,x.path)"],
    ['e.agent==="phoenix"?pc(e.origin,e.yaw,e.right,Math.min(n,$o),e.scale)', 'e.agent==="phoenix"?__aimPhxAt(e.origin,e.yaw,e.right,Math.min(n,$o),e.scale,e.path)'],
    ["origin:$e.origin,yaw:$e.yaw,right:$e.right,scale:$e.scale,thrownAt:$e.thrownAt", "origin:$e.origin,yaw:$e.yaw,right:$e.right,scale:$e.scale,path:$e.path,thrownAt:$e.thrownAt"],
  ],
};
const PREFIX = {
  "BiMsX6Xn.js": "",
  "CnrSARj_.js": 'import{__aimPhxBounce}from"./BiMsX6Xn.js";\n',
  "OkAdunfX.js": 'import{__aimPhxAt}from"./BiMsX6Xn.js";\n',
};
const SUFFIX = { "BiMsX6Xn.js": "\nexport{__aimPhxAt,__aimPhxBounce};\n", "CnrSARj_.js": "", "OkAdunfX.js": "" };

function transform(name, src) {
  if (src.includes("phoenix-bounce-v1")) return src;
  if (name === "OkAdunfX.js" && !src.includes("phoenix-real-v1")) throw new Error("OkAdunfX.js needs phoenix-real-v1 first");
  for (const [a, b] of EDITS[name]) {
    const n = src.split(a).length - 1;
    if (n !== 1) throw new Error(`${name}: expected 1 match, got ${n}: ${a.slice(0, 90)}`);
    src = src.replace(a, () => b);
  }
  return PREFIX[name] + src + SUFFIX[name];
}
module.exports = { transform };

if (require.main === module) {
  const root = path.join(__dirname, "..");
  for (const dir of ["app/site/next/js", "app/site/_assets/r20261021-1/next/js"])
    for (const name of Object.keys(EDITS)) {
      const p = path.join(root, dir, name);
      fs.writeFileSync(p, transform(name, fs.readFileSync(p, "utf8")));
      console.log("patched", path.join(dir, name));
    }
}
