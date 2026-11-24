// next-bot-xray-v1 (24 Nov 2026): a fourth pre-aim aid, "Next bot through walls" (key nextBotXray). The next bot in
// the kill order glows through walls in your enemy highlight colour (bright edges, faint fill), so you can see where it
// stands while you line up the angle; wherever it is actually in view it looks normal.
// How: the actor renderer (Uf in CnrSARj_) gives that bot's body parts an x-ray twin, a child mesh sharing the part's
// geometry and skeleton, so it follows the exact pose in the same frame. The twin has no depth test and draws in the
// opaque pass with renderOrder 1 (blended, so it stays out of the transparent pass), and the real parts move to
// renderOrder 2: the map draws first (0), the twin over it, then the real bot wherever its own depth test passes. The
// x-rayed bot also skips the behind-a-wall culling (bot-visibility.mjs), or it would not be drawn at all. The colour is
// the enemy highlight's alHlColor (the twin material runs the same XO shader patch, wQ here, then overrides the colour).
// The kill order (Vy in OkAdunfX) records botOrder.nextId; the frame loop hands it to $.__aimXray once per frame.
// The aid is off by default in every drill (Easy too), so nobody's drills change on update; "All on" includes it.
// It counts like the other aids: a run with it on is unranked except in Easy drills.
//   node tools/patch-next-bot-xray.cjs        patches both copies of OkAdunfX.js and CnrSARj_.js (safe to run twice)
const fs = require('fs'), path = require('path');
const LABEL = 'nextBotXray:{label:"Next bot through walls",hint:"The next bot in the kill order glows through walls, so you can see where it stands while you line up the angle. Wherever it\'s in view it looks normal"},';
const HELPER = String.raw`/* next-bot-xray-v1 */const __aimXrayEdge="\n{\n  float alXrEdge = 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 );\n  gl_FragColor = vec4( alHlColor, mix( 0.16, 0.95, pow( alXrEdge, 1.6 ) ) );\n}\n";let __aimXrayMat=null;function __aimXrayMaterial(){if(__aimXrayMat)return __aimXrayMat;class X extends zD{onBeforeCompile(g){g.fragmentShader=g.fragmentShader.replace("#include <tonemapping_fragment>","#include <tonemapping_fragment>"+__aimXrayEdge);wQ(g)}customProgramCacheKey(){return"al-next-bot-xray"}}return __aimXrayMat=new X({color:0,blending:5,blendSrc:204,blendDst:205,depthTest:!1,depthWrite:!1,toneMapped:!1,fog:!1})}function __aimXraySet(t,on){const m=t.mesh;t.__aimXray=on;if(!m.__aimXrayParts){if(!on)return;m.__aimXrayParts=m.parts.map(p=>{const x=p.isSkinnedMesh?new b8(p.geometry,__aimXrayMaterial()):new RA(p.geometry,__aimXrayMaterial());p.isSkinnedMesh&&x.bind(p.skeleton,p.bindMatrix);x.name="aim-next-bot-xray",x.frustumCulled=!1,x.castShadow=!1,x.receiveShadow=!1,x.renderOrder=1,p.add(x);return{part:p,twin:x,order:p.renderOrder}})}for(const e of m.__aimXrayParts)e.twin.visible=on,e.twin.geometry=e.part.geometry,e.part.renderOrder=on?2:e.order}`;
const EDITS = {
  'OkAdunfX.js': [
    ['fa=["killOrder","aimLine","minimapBots"]', 'fa=["killOrder","aimLine","nextBotXray","minimapBots"]'],
    ['rs={headLines:!1,killOrder:!1,aimLine:!1,minimapBots:!1}', 'rs={headLines:!1,killOrder:!1,aimLine:!1,nextBotXray:!1,minimapBots:!1}'],
    ['ao={headLines:!0,killOrder:!0,aimLine:!0,minimapBots:!0},Vi={easy:ao,other:rs}', 'ao={headLines:!0,killOrder:!0,aimLine:!0,nextBotXray:!0,minimapBots:!0},Vi={easy:{...ao,/* next-bot-xray-v1: off until asked for */nextBotXray:!1},other:rs}'],
    ['minimapBots:{label:"Bots on minimap"', LABEL + 'minimapBots:{label:"Bots on minimap"'],
    ['default:return{easy:{...ao},other:{...rs}}', 'default:return{easy:{...Vi.easy},other:{...rs}}'],
    ['ds=ye(()=>ht.value.killOrder||ht.value.aimLine||ht.value.headLines)', 'ds=ye(()=>ht.value.killOrder||ht.value.aimLine||ht.value.headLines||ht.value.nextBotXray)'],
    ['go=ye(()=>({numbers:ht.value.killOrder,aimLine:ht.value.aimLine,headLines:ht.value.headLines}))', 'go=ye(()=>({numbers:ht.value.killOrder,aimLine:ht.value.aimLine,headLines:ht.value.headLines,nextBotXray:ht.value.nextBotXray}))'],
    ['const Ry={numbers:!0,aimLine:!0,headLines:!0},Cy=()=>({labels:[],next:0,ready:!1,aim:{shown:!1,x:0,y:0,deltaM:0}});function Oi(e){e.labels.length=0,e.ready=!1,e.next=0,e.aim.shown=!1,e.aim.x=0,e.aim.y=0,e.aim.deltaM=0}',
      'const Ry={numbers:!0,aimLine:!0,headLines:!0,nextBotXray:!1},Cy=()=>({labels:[],next:0,nextId:null,ready:!1,aim:{shown:!1,x:0,y:0,deltaM:0}});function Oi(e){e.labels.length=0,e.ready=!1,e.next=0,e.nextId=null,e.aim.shown=!1,e.aim.x=0,e.aim.y=0,e.aim.deltaM=0}'],
    ['y(g.aim,I,w,z)}else g.aim.shown=!1;', 'y(g.aim,I,w,z),g.nextId=z?z.id:null}else g.aim.shown=!1,g.nextId=null;'],
    ['gs.aimLine||(t.botOrder.current.aim.shown=!1)):Oi(t.botOrder.current));', 'gs.aimLine||(t.botOrder.current.aim.shown=!1)):Oi(t.botOrder.current));/* next-bot-xray-v1 */$?.__aimXray?.(gs.nextBotXray&&t.botOrder?.current.nextId!=null?[t.botOrder.current.nextId]:null);'],
  ],
  'CnrSARj_.js': [
    ['function Uf(A,g,D,w){', HELPER + 'function Uf(A,g,D,w){'],
    ['M=s=>{__aimDisposeLiveActors(s.mesh.root);', 'M=s=>{__aimXraySet(s,!1);__aimDisposeLiveActors(s.mesh.root);'],
    ['return{apply(s,Y,L,k,priorSnapshot=null){', 'return{__aimXray(ids){for(const[id,t]of B)__aimXraySet(t,!!ids&&ids.includes(id))},apply(s,Y,L,k,priorSnapshot=null){'],
    ['H.culled=!(r.visible&&F.intersectsSphere(e))||!!globalThis.__aimBotVisibility?.hidden(', 'H.culled=!(r.visible&&F.intersectsSphere(e))||!H.__aimXray&&!!globalThis.__aimBotVisibility?.hidden('],
  ],
};
function transform(name, s) {
  if (s.includes('next-bot-xray-v1')) return s;
  for (const [a, b] of EDITS[name]) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`${name}: expected 1 match, got ${n}: ${a.slice(0, 70)}`); s = s.replace(a, () => b); }
  return s;
}
module.exports = { transform, EDITS, HELPER };
if (require.main === module) for (const dir of ['app/site/next/js', 'app/site/_assets/r20261021-1/next/js']) for (const name of Object.keys(EDITS)) {
  const p = path.join(__dirname, '..', dir, name), s = fs.readFileSync(p, 'utf8'), out = transform(name, s);
  if (out === s) { console.log('already patched', p); continue; }
  fs.writeFileSync(p, out); console.log('patched', p);
}
