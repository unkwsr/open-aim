// Phoenix curveball drawn with the real VALORANT effect (marker phoenix-real-v1).
// The flash renderer (Lm/Em in OkAdunfX.js) gets a "phx" pack built by tools/flashfx/phx.recipe.json from the
// FModel export of Phoenix_E_3p_FlashProj_FOE (orb, ribbon trail, glare, warning ring, fire rim) and
// Phoenix_E_3p_FlashExplode (pop). The hand-made orb (ih) is only used while the pack is not loaded.
//   node tools/patch-phoenix-real.cjs          patch both OkAdunfX.js copies
//   require(...).transform(source)             patched text (used by previews/phoenix-flash-look/serve.cjs)
const fs = require("fs");
const path = require("path");

const MATS = 'phxTrail:{fs:"tint",tex:["tex_glow_01"],k:[1,1,0,1],k2:[7,.25,.2,0],additive:!0},' +
  'phxRay:{fs:"tex",tex:["FlashLocation_TEX"],k:[1,1,0,1],additive:!0},' +
  'phxFlashRay:{fs:"tex",tex:["LightShaft_TEX"],k:[1,1,0,1],additive:!0,ray:!0,twoSided:!0},' +
  'phxTele:{fs:"phxring",tex:[],k:[1,1,0,1],additive:!0},' +
  'phxBall:{fs:"tex",tex:["GlowA01_DIFF"],k:[1,1,0,0]},' +
  'phxRim:{fs:"phxrim",tex:["Phoenix_FirePan_TFX"],k:[2.186,2.5,1,1],k2:[30,1.8,.6,0],additive:!0},' +
  'phxRimSimple:{fs:"phxrim",tex:[],k:[1.5,1,0,1],k2:[1,1,1,0],additive:!0},' +
  'phxSolar:{fs:"tex",tex:["T_Mask_Ramp_Bar_Horizontal_Wiggly_Center"],k:[1,2,0,1],additive:!0},';

const SHADERS = 'tint:`void main(){' +
  ' vec4 t = texture(uT0, vUV); float m = uK.z < 0.5 ? t.r : uK.z < 1.5 ? t.a : dot(t.rgb, vec3(0.3333));' +
  ' float g = pow(max(m, 0.0), max(uK.x, 0.01)); vec3 e = uCol.rgb * uK2.rgb * g * uK.y;' +
  ' if (uK.w > 0.5) o = vec4(e * max(uCol.a, 0.0), 0.0); else emit(e, g * uCol.a); }`,' +
  'phxrim:`void main(){' +
  ' float t = uK.z > 0.5 ? pow(max(texture(uT0, vUV + vec2(0.0, -4.5 * uT)).r, 0.0), 0.7) : 1.0;' +
  ' vec3 e = uCol.rgb * uK2.rgb * t * fres(max(uK.x, 0.01)) * uK.y; o = vec4(e * max(uCol.a, 0.0), 0.0); }`,' +
  'phxring:`void main(){' +
  ' float r = length((vUV - 0.5) / 0.5); float a = smoothstep(0.7, 0.85, r) * (1.0 - smoothstep(0.9, 1.0, r));' +
  ' o = vec4(uCol.rgb * max(uCol.a, 0.0) * a * uK.y, 0.0); }`,';

// Timeline: orb system while flying (hidden for the first 0.07 s like the game's InitialHideTime), pop at detonation.
const CASE = 'case"phoenix":{/* phoenix-real-v1 */const P=h=>rt(pc(n.origin,n.yaw,n.right,Math.min(Math.max(h,0),$o),n.scale)),' +
  'd=Ts(n.origin,n.boom);o>=.07&&o<l&&s.push({sys:"phx.proj",t:o,pos:P(o),dir:d,trail:P,order:1,seed:r+3}),' +
  'o>=l&&o<l+1&&s.push({sys:"phx.boom",t:o-l,pos:rt(n.boom),dir:d,order:2,seed:r+4});break}';

const EDITS = [
  ['li={reyna:"rey",breach:"brc",skye:"sky",yoru:"yru",vyse:"vys"}', 'li={reyna:"rey",breach:"brc",skye:"sky",yoru:"yru",vyse:"vys",phoenix:"phx"}'],
  ['yruTrail:{', MATS + 'yruTrail:{'],
  ['liquid:`void main(){', SHADERS + 'liquid:`void main(){'],
  ['case"yoru":{const h=Ts(n.origin,n.target);if(n.fizzle)', CASE + 'case"yoru":{const h=Ts(n.origin,n.target);if(n.fizzle)'],
  // Lm: tell the round loop whether a pack is ready
  ['nearsighted(){return t?.active()??!1},', 'nearsighted(){return t?.active()??!1},has(k){return!!e?.hasPack(k)},'],
  // hand-made orb only for KAY/O, and for Phoenix until the pack has loaded
  ['!($e.agent!=="phoenix"&&$e.agent!=="kayo")&&Hs.push', '($e.agent==="kayo"||$e.agent==="phoenix"&&!d.has?.("phx"))&&Hs.push'],
];

function transform(src) {
  if (src.includes("phoenix-real-v1")) return src;
  for (const [a, b] of EDITS) {
    const n = src.split(a).length - 1;
    if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${a.slice(0, 80)}`);
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
