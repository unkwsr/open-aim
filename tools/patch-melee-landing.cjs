const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

const edits = {
  'OkAdunfX.js': [[
    'loco:Ws.current(),localVelocity:',
    'loco:Ws.current(),grounded:ce.player.grounded,verticalVelocity:ce.player.verticalVelocity,localVelocity:',
    'loco:Ws.current(),grounded:ce.player.grounded,localVelocity:'
  ]],
  'DXHU7cEs.js': [
    ['function ro(H){', 'function ro(H){const meleeLanding=H.knife?__aimCreateMeleeLanding():null;'],
    ["const J=Et(H['prev'],H['state']);", "const J=H.blendSeconds??Et(H['prev'],H['state']);"],
    ["(I-H['since'])/J", "(I-(H.blendStart??H['since']))/J"],
    ["bm(bz['loco'],bB,bA['seconds']", "bm(bz['loco'],meleeLanding.locomotion(bB),bA['seconds']", "bm(bz['loco'],meleeLanding(bB,bA.grounded,bA.seconds),bA['seconds']"],
    ["a3['visible']=bz['hidden']", "if(meleeLanding){meleeLanding.update(bz);a3.position.y=meleeLanding.motion.lift;a3.rotation.x=meleeLanding.motion.pitch;}a3['visible']=bz['hidden']"]
  ]
};
const updates = [];
for (const [name, replacements] of Object.entries(edits)) {
  const pair = ['next/js', '_assets/r20261021-1/next/js'].map(route => {
    const file = path.join(root, 'app/site', route, name);
    const original = fs.readFileSync(file, 'utf8');
    let updated = original;
    for (const [before, after, previousPatch] of replacements) {
      if (updated.includes(after)) continue;
      const anchor = previousPatch && updated.includes(previousPatch) ? previousPatch : before;
      assert.equal(updated.split(anchor).length, 2, 'Unexpected hook in ' + file);
      updated = updated.replace(anchor, after);
    }
    const line = "import {createMeleeLanding as __aimCreateMeleeLanding} from '/aim-viewmodel/melee-landing.mjs';\n";
    if (name === 'DXHU7cEs.js' && !updated.includes(line)) updated = line + updated;
    return { file, route, name, original, updated };
  });
  assert.equal(pair[0].updated, pair[1].updated);
  updates.push(...pair);
}
for (const { file, route, name, original, updated } of updates) {
  if (original === updated) continue;
  const saved = path.join(root, 'previews/melee-landing/before', route, name);
  fs.mkdirSync(path.dirname(saved), { recursive: true });
  if (!fs.existsSync(saved)) fs.copyFileSync(file, saved);
  fs.writeFileSync(file, updated);
}
