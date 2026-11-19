// KAY/O FLASH/drive with VALORANT's real flight and timing (marker kayo-sim-v1). Needs phoenix-bounce-v1 first.
// Data (FModel): Projectile_BaseGrenade 18 m/s, Projectile_BaseAbility gravity x0.3, ProjectileBounceComponent
// Bounciness 0.4 / Friction 0.6, stop under 1 m/s; Projectile_C_Grenadier_Flash: Explosion Timer 1.3 s
// (underhand 0.7 s), BounceExplosionTimer 0.5 s, Telegraph 0.3 s, Comp_FlashbangExplosion MaxDuration 2.25 s.
// At the throw the sim (CnrSARj_ flash loop) runs __aimKyoFlight: the bot aims at the star, the grenade flies
// ballistically, each 1/120 s step is traced against the map's projectile collision (no map: the thrower's floor),
// it bounces (Unreal's bounce formula) and pops 0.5 s after the first bounce, or at the fuse. The path (cross.kyP,
// a point every 0.05 s) goes to the renderer as shot.kpath. A flash stop with throw: "under" is the underhand throw.
//   node tools/patch-kayo-sim.cjs                patch both copies of BiMsX6Xn.js and CnrSARj_.js
//   require(...).transform(name, source)         patched text for one file
const fs = require("fs");
const path = require("path");

const HELPER = `/* kayo-sim-v1 */function __aimKyoFlight(c,ray){c.kyAt=c.thrownAt;delete c.kyP;delete c.kyB;const fuse=c.kUH===1?Yi.fuseUnder:Yi.fuse,o={x:c.throwX,y:c.throwY,z:c.throwZ},floorY=o.y-GS;
ray=ray||((p,dx,dy,dz,L)=>{if(dy>=0)return null;const q=(p.y-floorY)/-dy;return q>=0&&q<L?{t:q,nx:0,ny:1,nz:0}:null});
const tx0=c.tgtX??c.boomX,ty0=c.tgtY??c.boomY,tz0=c.tgtZ??c.boomZ,dx=tx0-o.x,dy=ty0-o.y,dz=tz0-o.z,L0=Math.hypot(dx,dy,dz)||1;
let v={x:dx/L0*Yi.speed,y:dy/L0*Yi.speed,z:dz/L0*Yi.speed},p={x:o.x,y:o.y,z:o.z},t=0,end=fuse,bounce=null,rec=.05;const st=1/120,pts=[o.x,o.y,o.z];
for(let k=0;k<4000&&t<end-1e-9;k++){const h=Math.min(st,end-t);v.y-=Yi.gravityReal*h;let rem=h,g=0;
while(rem>1e-9&&g++<4){const mx=v.x*rem,my=v.y*rem,mz=v.z*rem,M=Math.hypot(mx,my,mz);if(M<1e-7)break;const q=ray(p,mx/M,my/M,mz/M,M);
if(!q||!(q.t<M)){p={x:p.x+mx,y:p.y+my,z:p.z+mz};break}const f=Math.max(0,q.t-.01)/M;p={x:p.x+mx*f,y:p.y+my*f,z:p.z+mz*f},rem*=1-f;
let nx=q.nx,ny=q.ny,nz=q.nz,vn=v.x*nx+v.y*ny+v.z*nz;vn>0&&(nx=-nx,ny=-ny,nz=-nz,vn=-vn);const ux=v.x-nx*vn,uy=v.y-ny*vn,uz=v.z-nz*vn;
v={x:ux*.4-nx*vn*.4,y:uy*.4-ny*vn*.4,z:uz*.4-nz*vn*.4};bounce===null&&(bounce=t+h-rem,end=Math.min(fuse,bounce+Yi.afterBounce));if(Math.hypot(v.x,v.y,v.z)<1){v={x:0,y:0,z:0};break}}
t+=h;for(;t>=rec-1e-9;rec+=.05)pts.push(p.x,p.y,p.z)}
pts.push(p.x,p.y,p.z);c.kyP=pts.map(x=>Math.round(x*1e3)/1e3),c.kyB=bounce===null?null:Math.round(bounce*1e4)/1e4,c.boomX=p.x,c.boomY=p.y,c.boomZ=p.z,c.detonateAt=c.thrownAt+end,c.teleAt=c.detonateAt-Yi.telegraph}
function kS(n,e,t){`;

const EDITS = {
  "BiMsX6Xn.js": [
    ["Yi={fuse:.7,telegraph:.3,maxDuration:1.5,zeroThreshold:.015,gravity:9.8*.7}",
     "Yi={fuse:1.3,fuseUnder:.7,telegraph:.3,maxDuration:2.25,zeroThreshold:.015,gravity:9.8*.7,speed:18,gravityReal:9.8*.3,afterBounce:.5}"],
    // the first kS( is the one the phoenix bounce patch put after its helpers
    ["function kS(n,e,t){", HELPER],
    ["i.maxBlind=l.maxDuration,", 'i.maxBlind=l.maxDuration,r==="kayo"&&(n.throw==="under"?(i.kUH=1,i.detonateAt=t.elapsed+Yi.fuseUnder,i.teleAt=i.detonateAt-Yi.telegraph):delete i.kUH),'],
    ["return{path:e.phP??null,", "return{path:e.phP??null,kpath:e.kyP??null,kBounce:e.kyB??null,kUnder:e.kUH===1,"],
  ],
  "CnrSARj_.js": [
    ["Z.phAt!==Z.thrownAt)__aimPhxBounce(Z,t.projectile?(p,dx,dy,dz,L)=>wD(t.projectile,p.x,p.y,p.z,dx,dy,dz,L,-1/0,-1/0,t.sightSkip?.from??0,t.sightSkip?.to??0):null);",
     "Z.phAt!==Z.thrownAt)__aimPhxBounce(Z,t.projectile?(p,dx,dy,dz,L)=>wD(t.projectile,p.x,p.y,p.z,dx,dy,dz,L,-1/0,-1/0,t.sightSkip?.from??0,t.sightSkip?.to??0):null);" +
     "/* kayo-sim-v1 */if(fA===\"kayo\"&&Z.thrownAt>=0&&Z.kyAt!==Z.thrownAt)__aimKyoFlight(Z,t.projectile?(p,dx,dy,dz,L)=>wD(t.projectile,p.x,p.y,p.z,dx,dy,dz,L,-1/0,-1/0,t.sightSkip?.from??0,t.sightSkip?.to??0):null);"],
  ],
};
const PREFIX = { "BiMsX6Xn.js": "", "CnrSARj_.js": 'import{__aimKyoFlight}from"./BiMsX6Xn.js";\n' };
const SUFFIX = { "BiMsX6Xn.js": "\nexport{__aimKyoFlight};\n", "CnrSARj_.js": "" };

function transform(name, src) {
  if (src.includes("kayo-sim-v1")) return src;
  if (!src.includes("phoenix-bounce-v1")) throw new Error(name + " needs phoenix-bounce-v1 first");
  for (const [a, b] of EDITS[name]) {
    const n = src.split(a).length - 1;
    if (n < 1 || (n > 1 && a !== "function kS(n,e,t){")) throw new Error(`${name}: expected 1 match, got ${n}: ${a.slice(0, 90)}`);
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
