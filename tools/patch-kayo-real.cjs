// KAY/O FLASH/drive drawn with the real VALORANT effect (marker kayo-real-v1). Needs the phoenix patches first
// (shares their "tint" / "phxrim" shaders). Pack "kyo" from tools/flashfx/kyo.recipe.json (FModel export of
// Grenadier/S0/VFX/Ability_Q: ps_trail_01 + ps_nanogelGrenade_loop_01 in flight, ps_Grenade_Ball_foe_VFX armed,
// ps_Grenade_Elec_Ball_foe_VfX armed underhand, PS_BounceImpact2 on a bounce, ps_flashbang_explosion pop).
// Flight comes from shot.kpath (positions every KYO_DT s, made by the sim: real ballistics + bounces),
// shot.kBounce (time of the first bounce or null), shot.kUnder (underhand throw).
//   node tools/patch-kayo-real.cjs        patch both OkAdunfX.js copies
//   require(...).transform(source)         patched text (previews/kayo-flash-look/serve.cjs)
const fs = require("fs");
const path = require("path");

const MATS = 'kyoGlowTrans:{fs:"tex",tex:["tex_glow_01"],k:[1,1,0,0]},' +
  'kyoGlowAdd:{fs:"tex",tex:["tex_glow_01"],k:[1,1,0,1],additive:!0},' +
  'kyoFlat:{fs:"kyoflat",tex:[],k:[0,1,0,1],k2:[1,.89,.52,0],additive:!0},' +
  'kyoRibbon:{fs:"tex",tex:["tex_glow_01"],k:[1,1,0,1],additive:!0},' +
  'kyoSphere:{fs:"phxrim",tex:[],k:[2,1,0,1],k2:[1,1,1,0],additive:!0},' +
  'kyoNanogel:{fs:"tint",tex:["tex_uvGrenade_01"],k:[1,1,2,0],k2:[.35,.6,1,0]},' +
  'kyoFlare:{fs:"tex",tex:["T_Flare_Starburst_03"],k:[1,1,0,1],additive:!0},' +
  'kyoElec:{fs:"tex",tex:["Elec_7x6_Dissolve_Tex_Grayscale"],k:[1,1,0,1],k2:[7,6,0,0],additive:!0},' +
  'kyoSplash:{fs:"tex",tex:["tex_liquid_sheet_11"],k:[1,1,0,1],additive:!0},' +
  'kyoRay:{fs:"tex",tex:["LightShaft_TEX"],k:[1,1,0,1],additive:!0,ray:!0,twoSided:!0},';

const SHADERS = 'kyoflat:`void main(){ o = vec4(uCol.rgb * uK2.rgb * uK.y * max(uCol.a, 0.0), 0.0); }`,';

// Timeline: flight, the armed glow for the last 0.3 s (underhand: its electric version), the bounce splash, the pop.
const CASE = 'case"kayo":{/* kayo-real-v1 */const p=n.kpath,DT=.05,P=h=>{if(!p||p.length<6)return rt(n.boom);const f=Math.max(0,h)/DT,m=p.length/3-1,i=Math.min(m-1,Math.floor(f)),w=Math.min(1,f-i),a=i*3;return[p[a]+(p[a+3]-p[a])*w,p[a+1]+(p[a+4]-p[a+1])*w,p[a+2]+(p[a+5]-p[a+2])*w]},' +
  'd=Ts(n.origin,n.boom),arm=Math.max(0,l-.3);' +
  'o<l&&s.push({sys:"kyo.fly",t:o,pos:P(o),dir:d,trail:P,order:1,seed:r+3}),' +
  'o>=arm&&o<l&&s.push({sys:n.kUnder?"kyo.armedUH":"kyo.armed",t:o-arm,pos:P(o),dir:d,trail:P,order:2,seed:r+5}),' +
  'n.kBounce!=null&&o>=n.kBounce&&o<n.kBounce+1&&s.push({sys:"kyo.bounce",t:o-n.kBounce,pos:P(n.kBounce),dir:[0,1,0],order:0,seed:r+7}),' +
  'o>=l&&o<l+1.2&&s.push({sys:"kyo.boom",t:o-l,pos:rt(n.boom),dir:d,order:3,seed:r+4});break}';

const EDITS = [
  ['vyse:"vys",phoenix:"phx"}', 'vyse:"vys",phoenix:"phx",kayo:"kyo"}'],
  ['yruTrail:{', MATS + 'yruTrail:{'],
  ['liquid:`void main(){', SHADERS + 'liquid:`void main(){'],
  ['case"yoru":{const h=Ts(n.origin,n.target);if(n.fizzle)', CASE + 'case"yoru":{const h=Ts(n.origin,n.target);if(n.fizzle)'],
  // the hand-made orb only for KAY/O until the pack has loaded
  ['($e.agent==="kayo"||$e.agent==="phoenix")&&Hs.push(', '($e.agent==="kayo"&&!d.has?.("kyo")||$e.agent==="phoenix")&&Hs.push('],
];

function transform(src) {
  if (src.includes("kayo-real-v1")) return src;
  if (!src.includes("phoenix-perf-v1")) throw new Error("needs the phoenix patches first");
  for (const [a, b] of EDITS) {
    const n = src.split(a).length - 1;
    if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${a.slice(0, 90)}`);
    src = src.replace(a, () => b);
  }
  return src;
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
