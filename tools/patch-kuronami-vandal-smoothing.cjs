const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const routes = ['next/js', '_assets/r20261021-1/next/js'];
const patches = {
  'OkAdunfX.js': [
    ['reloadSince:ce.reloadSince,equipAt:ce.player.equipTick',
      'reloadSince:ce.reloadSince,renderTickFraction:fe*ve,equipAt:ce.player.equipTick']
  ],
  'DXHU7cEs.js': [
    ['const reloadTime=reloadSeconds?bK*aA.armsReload.duration/reloadSeconds:bK;',
      `// Use the same fractional render time for both authored reload tracks.
   const reloadAge=kuronamiMotion?bK+(bz.renderTickFraction??0):bK;
   const reloadTime=reloadSeconds?reloadAge*aA.armsReload.duration/reloadSeconds:reloadAge;`],
    ["bR>0x0&&bf(a9['bones'],b8,bR);", "bR>0x0&&bf(a9['bones'],b8,kuronamiMotion?bR*bR*(3-2*bR):bR);"],
    ["bT>0x0&&bf(ad['bones'],b9,bT));", "bT>0x0&&bf(ad['bones'],b9,kuronamiMotion?bT*bT*(3-2*bT):bT));"]
  ]
};

const updates = [];
for (const [name, edits] of Object.entries(patches)) {
  const pair = routes.map(route => {
    const file = path.join(root, 'app/site', route, name);
    const original = fs.readFileSync(file, 'utf8');
    let updated = original;
    for (const [before, after] of edits) {
      if (updated.includes(after)) continue;
      assert.equal(updated.split(before).length, 2, 'Unexpected hook in ' + file);
      updated = updated.replace(before, after);
    }
    return { file, route, name, original, updated };
  });
  assert.equal(pair[0].updated, pair[1].updated, name + ' routes differ');
  updates.push(...pair);
}
for (const { file, route, name, original, updated } of updates) {
  if (original === updated) continue;
  const backup = path.join(root, 'previews/kuronami-vandal/before-smoothing', route, name);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  fs.writeFileSync(file, updated);
}
