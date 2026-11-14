// Used ONLY by the isolated draft server. Never writes a game bundle.
// Split's wide lighting range needs one irradiance scale per atlas.
const assert = require('node:assert/strict');
module.exports = function previewAdapter(bytes, options = {}) {
  let source = bytes.toString('utf8');
  for (const [before, after] of [
    ['bv(u,a,o,e)', 'bv(u,a,o,{...e,K:e.atlases[i]?.K??e.K}),s.userData.splitLighting={atlas:i,K:e.atlases[i]?.K??e.K}'],
    ['bv(h,f.irr,f.sh,e)', 'bv(h,f.irr,f.sh,{...e,K:e.atlases[i]?.K??e.K}),o.userData.splitLighting={atlas:i,K:e.atlases[i]?.K??e.K}'],
    // The original merger groups by material/attributes only. Multi-atlas drafts
    // must also group by lightmap image, otherwise other charts sample that image.
    ['function mF(n,e){const t=new Map;for(const r of n){const s=`${r.material.uuid}|${hh(r.geometry)}`',
     'function mF(n,e){const t=new Map;for(const r of n){const s=`${r.material.uuid}|${hh(r.geometry)}|${r.atlas??"-"}`'],
    ['const r=`${i.material.uuid}|${hh(i.geometry)}`,s=t.get(r);',
     'const r=`${i.material.uuid}|${hh(i.geometry)}|${i.atlas??"-"}`,s=t.get(r);'],

  ]) {
    assert.equal(source.split(before).length, 2, 'Preview adapter anchor changed: ' + before);
    source = source.replace(before, after);
  }
  if(options.textureCheck){
    const before='const r=HP(i);if(r.merged!==0)';
    assert.equal(source.split(before).length,2,'Texture-check merge anchor changed');
    source=source.replace(before,'const r=HP(new Set);if(r.merged!==0)');
  }
  return Buffer.from(source);
};
