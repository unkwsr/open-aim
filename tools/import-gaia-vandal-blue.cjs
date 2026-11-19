const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const exported = path.resolve(process.argv[2] ?? path.join(root,
  'exports/gaia-vandal-blue/ShooterGame/Content/Equippables/Guns/Rifles/AK/Ashen'));
const output = path.join(root, 'app/site/aim-viewmodel');
const id = 'gaia-vandal-blue';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const chroma = read(path.join(exported, 'Chromas/v1/AK_Ashen_v1_UIData.json'))
  .find(entry => entry.Properties?.DisplayName);
assert.match(chroma.Properties.DisplayName.SourceString, /Variant 1 Blue/);

// Gaia chromas share the model, animation blocks, and UVs. Keep the White pack's
// rig and offsets and point the Blue manifest at the same binary in the loader.
const source = read(path.join(output, 'gaia-vandal-white.json'));
const [crystal, bark] = source.skinMaterials;
const manifest = {
  ...source,
  skin: { id, name: "Gaia's Vengeance Vandal (Blue)", source: chroma.Package },
  gun: { ...source.gun, texture: id + '-color.png', normalTexture: id + '-normal.png',
    ormTexture: id + '-orm.png', emissiveTexture: id + '-emissive.png' },
  skinMaterials: [
    { ...crystal, name: 'Gaia Blue Crystal', gaiaBlueFinish: 'crystal', ormTexture: false,
      baseColorTexture: true, baseColorFactor: [.16, .26, .34, 1], normalScale: .72,
      roughness: .22, metalness: .18, emissiveFromBase: [.72, .86, 1.1] },
    { ...bark, name: 'Gaia Blue Bark', gaiaBlueFinish: 'bark', roughness: .82, metalness: .43,
      normalScale: .73, emissiveTexture: true }
  ]
};

execFileSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/build-kuronami-textures.ps1'),
  '-GaiaBlueExport', exported], { stdio: 'inherit' });
fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(manifest));
