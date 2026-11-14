// Used ONLY by the isolated draft server. Never writes a game bundle.
// Haven's wide lighting range needs one irradiance scale per atlas.
const assert = require('node:assert/strict');
module.exports = function previewAdapter(bytes) {
  let source = bytes.toString('utf8');
  for (const [before, after] of [
    ['bv(u,a,o,e)', 'bv(u,a,o,{...e,K:e.atlases[i]?.K??e.K}),s.userData.havenLighting={atlas:i,K:e.atlases[i]?.K??e.K}'],
    ['bv(h,f.irr,f.sh,e)', 'bv(h,f.irr,f.sh,{...e,K:e.atlases[i]?.K??e.K}),o.userData.havenLighting={atlas:i,K:e.atlases[i]?.K??e.K}'],
    // The original merger groups by material/attributes only. Multi-atlas drafts
    // must also group by lightmap image, otherwise other charts sample that image.
    ['function mF(n,e){const t=new Map;for(const r of n){const s=`${r.material.uuid}|${hh(r.geometry)}`',
     'function mF(n,e){const t=new Map;for(const r of n){const s=`${r.material.uuid}|${hh(r.geometry)}|${r.atlas??"-"}`'],
    ['const r=`${i.material.uuid}|${hh(i.geometry)}`,s=t.get(r);',
     'const r=`${i.material.uuid}|${hh(i.geometry)}|${i.atlas??"-"}`,s=t.get(r);'],
    // These materials have dedicated preview shaders and must not be folded
    // into the generic texture-array material before those shaders are applied.
    ['const r=HP(i);if(r.merged!==0)',
     'const r=HP(new Set([...i].filter(m=>!["Floater_1_M0_EdgeDestructionDecal_MI","DamageCracks_M0_A_MI","Floater_12_M0_PlasterDestruction_MI","Floater_13_M0_LongBricksDestructionHorizontal_MI","Floater_13_M0_LongBricksDestructionPatches_MI1","Floater_14_M0_LongBricks_MI","Gravel_0_M0_PebblesRocks_MI","Paint_M0_AsphaltStreetB_MI"].includes(m.name))));if(r.merged!==0)'],
  ]) {
    assert.equal(source.split(before).length, 2, 'Preview adapter anchor changed: ' + before);
    source = source.replace(before, after);
  }
  return Buffer.from(source);
};
