// Phoenix curveball: same look, less CPU per frame (marker phoenix-perf-v1). Needs phoenix-real-v1 + phoenix-bounce-v1.
// Profiled (previews/phoenix-flash-look/prof.cjs): most of the cost was the ribbon trail, which the flash renderer
// can only draw as ~200 sprites, each one re-running the whole curve flight every frame.
//  - The trail is drawn as one strip by the orb renderer (ih) with the real ribbon numbers (Phoenix_E_3p_FlashProj_FOE
//    "Trail": 0.4 s, width 7 cm x 1.2 at the ball -> x 0.2 at the end, red), additive. The pack has no ribbon emitter.
//  - The flight path for the flash renderer is sampled once per throw (every 0.01 s) and reused.
//   node tools/patch-phoenix-perf.cjs        patch both OkAdunfX.js copies
//   require(...).transform(source)           patched text
const fs = require("fs");
const path = require("path");

const TRAIL = ',Ct=(g,I,P)=>{/* phoenix-perf-v1: real ribbon as one strip */const x=Rt.trailSamples,z=g.trail.geometry.getAttribute("position"),M=g.trail.geometry.getAttribute("color"),w=Math.min(.4,P);if(w<.001){g.trail.geometry.setDrawRange(0,0);return}' +
  'for(let U=0;U<=x;U+=1){const k=U/x,L=P-w*k,D=I(L),H=I(Math.min(P,L+w/x));h.set(H.x-D.x,H.y-D.y,H.z-D.z),h.lengthSq()<1e-12&&h.set(0,0,1),d.set(t.position.x-D.x,t.position.y-D.y,t.position.z-D.z),p.crossVectors(h,d),p.lengthSq()<1e-12&&p.set(1,0,0),p.normalize().multiplyScalar(.035*(1.2-k));' +
  'const ee=U*2;z.setXYZ(ee,D.x+p.x,D.y+p.y,D.z+p.z),z.setXYZ(ee+1,D.x-p.x,D.y-p.y,D.z-p.z);const r0=1-.4*k,g0=.42-.38*k,b0=.34-.3*k,a0=.9*(1-k);M.setXYZW(ee,r0,g0,b0,a0),M.setXYZW(ee+1,r0,g0,b0,a0)}' +
  'z.needsUpdate=!0,M.needsUpdate=!0,g.trail.geometry.setDrawRange(0,x*6),g.trail.visible=!0},E=new dt(Nn.glowEdge)';

const SAMPLER = 'const __aimPhxMemo=new Map;function __aimPhxSampler(n){const k=n.thrownAt+","+n.origin.x+","+n.origin.z+","+n.yaw+","+(n.path?n.path[n.path.length-1]:0);let a=__aimPhxMemo.get(k);' +
  'if(!a){a=new Float32Array(3*72);for(let i=0;i<72;i++){const q=__aimPhxAt(n.origin,n.yaw,n.right,Math.min(i*.01,$o),n.scale,n.path);a[i*3]=q.x,a[i*3+1]=q.y,a[i*3+2]=q.z}__aimPhxMemo.size>15&&__aimPhxMemo.clear(),__aimPhxMemo.set(k,a)}' +
  'return h=>{const f=Math.min(Math.max(h,0),$o)/.01,i=Math.min(70,Math.floor(f)),w=f-i,j=i*3;return[a[j]+(a[j+3]-a[j])*w,a[j+1]+(a[j+4]-a[j+1])*w,a[j+2]+(a[j+5]-a[j+2])*w]}}\n';

const EDITS = [
  // the orb renderer keeps drawing Phoenix's trail when the pack is loaded (trailOnly)
  ['($e.agent==="kayo"||$e.agent==="phoenix"&&!d.has?.("phx"))&&Hs.push({id:xe.id,...$e.agent==="kayo"?{agent:"kayo",target:$e.target}:{},',
   '($e.agent==="kayo"||$e.agent==="phoenix")&&Hs.push({id:xe.id,...$e.agent==="kayo"?{agent:"kayo",target:$e.target}:d.has?.("phx")?{trailOnly:1}:{},'],
  ['U=O($o);if(M<0){', 'U=O($o);if(x.trailOnly){if(M<0){const S=__aimPhxSampler(x);w.trail.material.blending=Ko,Ct(w,k=>{const a=S(k);return{x:a[0],y:a[1],z:a[2]}},z)}continue}if(M<0){'],
  ['C(w,O,z);', '(w.trail.material.blending=1,C(w,O,z));'],
  [',E=new dt(Nn.glowEdge)', TRAIL],
  ['const P=h=>rt(__aimPhxAt(n.origin,n.yaw,n.right,Math.min(Math.max(h,0),$o),n.scale,n.path))', 'const P=__aimPhxSampler(n)'],
];

function transform(src) {
  if (src.includes("phoenix-perf-v1")) return src;
  if (!src.includes("__aimPhxAt")) throw new Error("needs phoenix-bounce-v1 first");
  for (const [a, b] of EDITS) {
    const n = src.split(a).length - 1;
    if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${a.slice(0, 90)}`);
    src = src.replace(a, () => b);
  }
  return SAMPLER + src;
}
module.exports = { transform };

if (require.main === module) {
  const root = path.join(__dirname, "..");
  for (const rel of ["app/site/next/js/OkAdunfX.js", "app/site/_assets/r20261021-1/next/js/OkAdunfX.js"]) {
    const p = path.join(root, rel);
    fs.writeFileSync(p, transform(fs.readFileSync(p, "utf8")));
    console.log("patched", rel);
  }
}
