const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const source = process.argv[2];
assert(source, 'Pass the FModel AK/Ninja export directory.');
const output = path.resolve(__dirname, '../app/site/aim-viewmodel');
const shared = path.resolve(source, '../../../../_Core/Materials/SpecialMaterials/Ninja');
const family = 'kuronami-vandal';
const template = JSON.parse(fs.readFileSync(path.join(output, family + '-white.json')));
assert(template.kuronamiVandalMotion, 'Build the native Kuronami animation pack first.');
for (const { file, sha256 } of template.skin.sources.slice(0, 2)) {
  const bytes = fs.readFileSync(path.join(source, 'Models', file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, file);
}

function copy(file, name) {
  fs.copyFileSync(file, path.join(output, family + '-' + name));
  return family + '-' + name;
}

function packedMaps(prefix, fileStem) {
  return Object.fromEntries(Object.entries({ DF: 'color', NM: 'normal', MRS: 'mrs', AEM: 'aem' })
    .map(([channel, label]) => [label, copy(prefix + '_' + channel + '.png', fileStem + '-' + label + '.png')]));
}

function maps({ color, normal, mrs, aem }) {
  return { map: color, normalMap: normal, roughnessMap: mrs, metalnessMap: mrs, aoMap: aem };
}

const shuriken = packedMaps(path.join(shared, 'Ninja_Shuriken'), 'shared-shuriken');
const decal = {
  map: copy(path.join(shared, 'Ninja_Decal_DF.png'), 'shared-decal-color.png'),
  normalMap: copy(path.join(shared, 'Ninja_Decal_NM.png'), 'shared-decal-normal.png')
};

// Water and decal colors adapt the exported tints to the trainer's lighting.
const chromas = [
  { id: 'standard', label: 'Standard', chroma: '', water: [.78, .93, 1], light: [.04, .35, .72], decal: [.18, 1.32, 3.3] },
  { id: 'purple', label: 'Purple', chroma: 'v1', water: [.48, .4, .83], light: [.21, .08, .6], decal: [.52, .34, 3.2],
    shuriken: 'v1/Reload/Tex/Ninja_AK_Shuriken_DF_V3.png' },
  { id: 'white', label: 'White', chroma: 'v2', water: [.5, .58, .72], light: [.02, .07, .14], decal: [.5, 1.5, 3.5],
    shuriken: 'v2/Particles/Reload/Tex/Ninja_AK_Shuriken_D_v2.png' },
  { id: 'black-red', label: 'Black', chroma: 'v3', water: [.43, .38, .45], light: [.3, .05, .08], decal: [.85, 1.29, 3],
    shuriken: 'v3/Reload/Tex/Ninja_AK_Shuriken_DF_03.png' }
];

for (const variant of chromas) {
  const { id, label, chroma } = variant;
  const dir = chroma ? path.join(source, 'Chromas', chroma, 'Materials') : path.join(source, 'Materials');
  const body = packedMaps(path.join(dir, 'AK_Ninja' + (chroma ? '_' + chroma : '')), id + '-body');
  const blade = variant.shuriken
    ? { ...shuriken, color: copy(path.join(source, 'VFX/Chroma', variant.shuriken), id + '-shuriken-color.png') }
    : shuriken;
  const idFull = family + '-' + id;
  const [skin, water, mark, star] = template.skinMaterials;
  const standard = id === 'standard';
  const black = id === 'black-red';
  const manifest = {
    ...template,
    gun: { ...template.gun, texture: body.color },
    skin: { ...template.skin, id: idFull, name: 'Kuronami Vandal ' + label },
    skinMaterials: [
      { ...skin, name: label + ' body', materialMaps: maps(body), normalScaleY: -1,
        kuronamiMaps: standard ? 'standard-steel' : black ? 'black-steel' : 'packed',
        baseColorFactor: id === 'white' ? [.78, .8, .84, 1] : [1, 1, 1, 1],
        emissiveFactor: variant.light.map(value => value * .33) },
      { ...water, name: label + ' water', materialMaps: maps(body), normalScaleY: -1,
        kuronamiMaps: standard ? 'standard-water' : black ? 'black-water' : 'packed',
        baseColorFactor: [...variant.water, id === 'white' ? .4 : .6], emissiveFactor: variant.light },
      { ...mark, name: label + ' decals', materialMaps: decal, normalScaleY: -1, kuronamiMaps: 'decal',
        baseColorFactor: [1, 1, 1, 1], emissiveFactor: variant.decal, metalness: .15 },
      { ...star, name: label + ' shuriken', materialMaps: maps(blade), normalScaleY: -1, kuronamiMaps: 'packed',
        baseColorFactor: [1, 1, 1, 1], emissiveFactor: variant.light }
    ]
  };
  fs.writeFileSync(path.join(output, idFull + '.json'), JSON.stringify(manifest));
}
