const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readGlb, accessor, pack } = require('./valorant-melee-assets.cjs');
const { readPsa } = require('../previews/bot-anims/psa.cjs');

const root = path.resolve(__dirname, '..');
const content = 'ShooterGame/Content/Equippables/Guns';
const exported = path.resolve(process.argv[2] ?? path.join(root, 'exports/xenohunter-knife', content));
const properties = path.resolve(process.argv[3] ?? path.join(process.env.USERPROFILE, 'Desktop/Output/Exports', content));
const redDot = 'Attachments/RedDot';
const ninja = path.join(redDot, 'Ninja');
const rifle = 'Rifles/AK/Ninja';
const output = path.join(root, 'app/site/aim-viewmodel');
const sourceMesh = 'GN_RedDot_Ninja_Lv1_Skelmesh';
const reticleMask = 'VFX/Ninja_ADS_Tex03_03.png';
const readProperties = file => JSON.parse(fs.readFileSync(path.join(properties, file), 'utf8'));
const defaults = exports => exports.find(item => item.Name?.startsWith('Default__')).Properties;
const variants = {};

for (const [variant, chroma] of [['standard', ''], ['black-red', 'v3']]) {
  const chromaDir = chroma ? 'Chromas/' + chroma : '';
  const suffix = chroma ? '_' + chroma : '';
  const weapon = path.join(rifle, chromaDir, 'AK_Ninja' + suffix);
  const ui = readProperties(weapon + '_UIData.json').find(item => item.Properties?.DisplayName);
  const identity = ui.Properties.DisplayName.SourceString;
  assert(chroma ? /^Kuronami Vandal.*\s+\(Variant 3 Black\)$/.test(identity) : identity === 'Kuronami Vandal');
  const blueprint = 'Attachment_Ninja_RedDot' + suffix;
  const override = readProperties(weapon + '_PrimaryAsset.json').flatMap(
    item => item.Properties?.AttachmentOverrides ?? []
  ).find(item => item.Key.includes('Attachment_Base_Reflex_RedDot'));
  assert(override.Value.AssetPathName.endsWith('/' + blueprint + '.' + blueprint + '_C'));
  const attachment = defaults(readProperties(path.join(ninja, chromaDir, blueprint + '.json')));
  assert(attachment['1pReflexMesh'].AssetPathName.endsWith('/' + sourceMesh + '.' + sourceMesh));
  const openController = attachment['Red Dot Open'].ObjectPath.replace(/^\/Game\/Equippables\/Guns\//, '').replace(/\.0$/, '.json');
  assert(readProperties(openController).some(item => item.Super?.ObjectPath.endsWith('/FXC_RedDot_Open.0')));

  const lensFile = 'Materials/RedDot_Ninja_Water' + suffix + '_MI.json';
  const lens = chroma
    ? readProperties(path.join(ninja, chromaDir, lensFile))[0].Properties.VectorParameterValues
      .find(param => param.ParameterInfo.Name === 'Scan_Color').ParameterValue
    : JSON.parse(fs.readFileSync(path.join(exported, ninja, lensFile))).Colors.Scan_Color;
  const color = [lens.R, lens.G, lens.B];
  const peak = Math.max(...color);
  const reticleMaterial = chroma ? 'Chromas/v3/VFX/Materials' : 'VFX/Mat';
  const expressions = readProperties(path.join(ninja, reticleMaterial, 'ADS_Ninja_Mat.json'))[0].CachedExpressionData;
  const panelColorIndex = expressions['RuntimeEntries[1]'].ParameterInfoSet.findIndex(item => item.Name === 'Param_1');
  const { R, G, B } = expressions.VectorValues[panelColorIndex];
  variants[variant] = { chroma, lensColor: color.map(channel => channel / peak), reticleColor: [R, G, B] };
}

const glb = readGlb(path.join(exported, ninja, 'Models', sourceMesh + '.glb'));
const jointIds = glb.json.skins[0].joints;
const nodes = jointIds.map(id => glb.json.nodes[id]);
const position = ([x, y, z]) => [100 * x, -100 * z, 100 * y];
const direction = ([x, y, z]) => [x, -z, y];
const bones = {
  names: nodes.map(node => node.name),
  parents: jointIds.map(id => jointIds.findIndex(parent => glb.json.nodes[parent].children?.includes(id))),
  t: nodes.flatMap(node => position(node.translation ?? [0, 0, 0])),
  q: nodes.flatMap(({ rotation: [x, y, z, w] = [0, 0, 0, 1] }) => [x, -z, y, w]),
};
assert(bones.names.includes('ScopeTarget'));

const pos = [], nrm = [], uv = [], bone = [], idx = [], groups = [];
for (const primitive of glb.json.meshes[0].primitives) {
  const material = /Water/.test(glb.json.materials[primitive.material].name) ? 'lens' : 'body';
  const attributes = primitive.attributes;
  const baseVertex = pos.length / 3;
  const indices = accessor(glb, primitive.indices).map(([index]) => baseVertex + index);
  groups.push({ start: idx.length, count: indices.length, material });
  idx.push(...indices);
  pos.push(...accessor(glb, attributes.POSITION).flatMap(position));
  nrm.push(...accessor(glb, attributes.NORMAL).flatMap(direction));
  uv.push(...accessor(glb, attributes.TEXCOORD_0).flat());
  const joints = accessor(glb, attributes.JOINTS_0);
  bone.push(...accessor(glb, attributes.WEIGHTS_0).map((weights, index) => {
    const rigid = weights.findIndex(weight => weight > .999);
    assert(rigid >= 0, 'The reflex device requires rigid skin weights');
    return joints[index][rigid];
  }));
}
assert.deepEqual(groups.map(group => group.material), ['body', 'lens']);
assert(pos.length / 3 <= 65536 && bones.names.length <= 256);
const floats = values => Buffer.from(Float32Array.from(values).buffer);
const packed = pack([
  ['pos', floats(pos)], ['nrm', floats(nrm)], ['uv', floats(uv)],
  ['bone', Buffer.from(bone)], ['idx', Buffer.from(Uint16Array.from(idx).buffer)],
]);
const offsets = Object.fromEntries(Object.entries(packed.offsets).map(([key, [offset]]) => [key, offset]));

// Both Ninja open controllers inherit the shared S0 controller. Bake one
// open-idle pose from its ANIMKEYS so the game never samples a motion track.
const poseSource = 'S0/Anims/Export/GN_RedDot_S0_Open_Idle.psa';
const psa = readPsa(path.join(exported, redDot, poseSource));
const openPose = bones.names.map(name => {
  const source = psa.bones.findIndex(bone => bone.name === name);
  assert(source >= 0, 'Missing source pose bone ' + name);
  const index = psa.sequences[0].firstFrame * psa.bones.length + source;
  const q = [...psa.quat.subarray(index * 4, index * 4 + 4)];
  if (psa.bones[source].parent >= 0 && source !== 0) q[3] *= -1;
  const length = Math.hypot(...q);
  return [...psa.pos.subarray(index * 3, index * 3 + 3), ...q.map(value => value / length)];
});

const reticleMesh = readGlb(path.join(exported, ninja, 'VFX/Mesh/ADS_Ninja_Lines_SM.glb'));
const outline = reticleMesh.json.accessors[reticleMesh.json.meshes[0].primitives[0].attributes.POSITION];
const panel = readProperties(path.join(ninja, 'VFX/Particle/ADS_Ninja_ProjectionPannel_VFX.json'));
const resolve = ref => panel[Number(ref.ObjectPath.split('.').at(-1))];
const steadyPanel = panel.find(item => item.Name === 'ParticleSpriteEmitter_7');
const lod = resolve(steadyPanel.Properties.LODLevels[0]).Properties;
assert(resolve(lod.TypeDataModule).Properties.Mesh.ObjectName.includes('ADS_Ninja_Lines_SM'));
const modules = lod.Modules.map(resolve);
const scale = modules.find(item => item.Type === 'ParticleModuleSize').Properties.StartSize.Table.Values;
const offset = modules.find(item => item.Type === 'ParticleModuleLocation').Properties.StartLocation.Table.Values;
// The sharp mask already contains both halves of the reticle. Size its flat
// surface by matching the visible area of the texture to the native mesh.
const reticle = {
  width: (outline.max[0] - outline.min[0]) * 100 * scale[0] / .78,
  height: (outline.max[1] - outline.min[1]) * 100 * scale[2] / .69,
  offsetY: offset[2],
};

execFileSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/build-kuronami-textures.ps1'),
  '-KuronamiReflexExport', path.join(exported, ninja)], { stdio: 'inherit' });
fs.copyFileSync(path.join(exported, ninja, reticleMask), path.join(output, 'kuronami-reflex-reticle.png'));
fs.writeFileSync(path.join(output, 'kuronami-reflex.mesh.bin'), packed.bytes);
fs.writeFileSync(path.join(output, 'kuronami-reflex.json'), JSON.stringify({
  kuronamiReflex: true, identity: 'Kuronami Vandal', socket: 'Reflex', sourceMesh, poseSource, variants, openPose, reticle,
  device: { vertices: pos.length / 3, indices: idx.length, bones, offsets, groups },
}));
console.log('Built static Kuronami reflex for Standard and Black.');
