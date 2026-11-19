// Phoenix curveball look: red-orange orb + halo, thicker fading trail, shine on ball and trail.
// Marker phoenix-bright-v1. Patches both OkAdunfX.js copies. Preview: previews/phoenix-flash-look/.
// Undo: copy backups/phoenix-bright-2026-11-15/{next,_assets}/OkAdunfX.js back.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const files = ["app/site/next/js/OkAdunfX.js", "app/site/_assets/r20261021-1/next/js/OkAdunfX.js"];
const edits = [
  // constants
  ['Rt={ballRadius:.1,ballColor:"#15100d",rimHot:"#ffff99",rimEdge:"#e7255e",glowScale:6,trailHot:"#ffffff",trailWarm:"#ff4444",trailSeconds:.32,trailSamples:14,trailHalfWidthM:.11}',
   'Rt={/* phoenix-bright-v1 */ballRadius:.14,ballColor:"#dd6a40",rimHot:"#da522f",rimEdge:"#c0302a",glowScale:6,trailHot:"#dd743c",trailWarm:"#b1261f",trailSeconds:.5,trailSamples:20,trailHalfWidthM:.26,shine:"#f1dcae",shineSize:.5,trailShine:"#eccb93",trailShineHalfWidthM:.07}'],
  // trail geometry: rgba vertex colours (alpha fade)
  ['n.setAttribute("color",new it(new Float32Array(t*3),3));const s=[];for(let a=0;a<e;a+=1)',
   'n.setAttribute("color",new it(new Float32Array(t*4),4));const s=[];for(let a=0;a<e;a+=1)'],
  // shine colour
  ['c=new dt(Rt.trailHot),l=new dt(Rt.trailWarm),',
   'c=new dt(Rt.trailHot),l=new dt(Rt.trailWarm),sv=new dt(Rt.trailShine),'],
  // meshes: trail painted over the wall (normal blending) + shine sprite + trail centre line (additive)
  ['P=new mt(lh(),new os({vertexColors:!0,transparent:!0,opacity:1,blending:Ko,depthWrite:!1,depthTest:!0,side:An})),',
   'P=new mt(lh(),new os({vertexColors:!0,transparent:!0,opacity:1,blending:1,depthWrite:!1,depthTest:!0,side:An})),ts=new mt(lh(),new os({vertexColors:!0,transparent:!0,opacity:1,blending:Ko,depthWrite:!1,depthTest:!0,side:An})),sh=f(new dt(Rt.shine),1),'],
  ['z=f(u,0);P.renderOrder=9,I.renderOrder=10,x.renderOrder=11,z.renderOrder=12;const M={ball:g,glow:I,trail:P,ring:x,pop:z};for(const w of[g,I,P,x,z])e.add(w);return M}',
   'z=f(u,0);P.renderOrder=9,ts.renderOrder=9.5,I.renderOrder=10,x.renderOrder=11,z.renderOrder=12,sh.renderOrder=13;const M={ball:g,glow:I,trail:P,ring:x,pop:z,shine:sh,tshine:ts};for(const w of[g,I,P,x,z,sh,ts])e.add(w);return M}'],
  ['for(const I of[g.ball,g.glow,g.trail,g.ring,g.pop])e.remove(I),I.material.dispose();g.trail.geometry.dispose()}',
   'for(const I of[g.ball,g.glow,g.trail,g.ring,g.pop,g.shine,g.tshine])e.remove(I),I.material.dispose();g.trail.geometry.dispose(),g.tshine.geometry.dispose()}'],
  ['g.ball.visible=!1,g.glow.visible=!1,g.trail.visible=!1,g.ring.visible=!1,g.pop.visible=!1}',
   'g.ball.visible=!1,g.glow.visible=!1,g.trail.visible=!1,g.ring.visible=!1,g.pop.visible=!1,g.shine.visible=!1,g.tshine.visible=!1}'],
  // trail fill
  ['M=g.trail.geometry.getAttribute("color"),w=Math.min(Rt.trailSeconds,P);',
   'M=g.trail.geometry.getAttribute("color"),sp=g.tshine.geometry.getAttribute("position"),sc=g.tshine.geometry.getAttribute("color"),fw=Rt.trailShineHalfWidthM/Rt.trailHalfWidthM,w=Math.min(Rt.trailSeconds,P);'],
  ['const oe=(1-k)**2;M.setXYZ(ee,v.r*oe,v.g*oe,v.b*oe),M.setXYZ(ee+1,v.r*oe,v.g*oe,v.b*oe),O=U}z.needsUpdate=!0,M.needsUpdate=!0,g.trail.geometry.setDrawRange(0,O*6),g.trail.visible=!0}',
   'const oe=(1-k)**2,al=1-k;M.setXYZW(ee,v.r,v.g,v.b,al),M.setXYZW(ee+1,v.r,v.g,v.b,al),sp.setXYZ(ee,D.x+p.x*fw,D.y+p.y*fw,D.z+p.z*fw),sp.setXYZ(ee+1,D.x-p.x*fw,D.y-p.y*fw,D.z-p.z*fw),sc.setXYZW(ee,sv.r*oe,sv.g*oe,sv.b*oe,1),sc.setXYZW(ee+1,sv.r*oe,sv.g*oe,sv.b*oe,1),O=U}z.needsUpdate=!0,M.needsUpdate=!0,sp.needsUpdate=!0,sc.needsUpdate=!0,g.trail.geometry.setDrawRange(0,O*6),g.trail.visible=!0,g.tshine.geometry.setDrawRange(0,O*6),g.tshine.visible=!0}'],
  // KAY/O keeps its additive glow (shares the meshes)
  ['g.glow.visible=!0,g.glow.position.copy(g.ball.position),g.glow.quaternion.copy(t.quaternion),g.glow.scale.set(k,k,1),',
   'g.glow.visible=!0,g.glow.material.blending=Ko,g.glow.position.copy(g.ball.position),g.glow.quaternion.copy(t.quaternion),g.glow.scale.set(k,k,1),'],
  // Phoenix glow: solid red-orange halo, full strength, plus the shine
  ['w.glow.material.opacity=.55+.45*D,w.glow.material.color.copy(r).lerp(u,D*.6),',
   'w.glow.material.blending=1,w.glow.material.opacity=1,w.glow.material.color.copy(r).lerp(u,D*.6),w.shine.visible=!0,w.shine.position.copy(w.ball.position),w.shine.quaternion.copy(t.quaternion),w.shine.scale.set(Rt.shineSize,Rt.shineSize,1),'],
];
for (const rel of files) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("phoenix-bright-v1")) { console.log("already patched", rel); continue; }
  for (const [a, b] of edits) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(`${rel}: expected 1 match, got ${n}: ${a.slice(0, 80)}`);
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(p, s);
  console.log("patched", rel);
}
