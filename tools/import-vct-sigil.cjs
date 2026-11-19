const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readGlb, accessor, arrays, addGlb, packMesh, convert, pack } = require('./valorant-melee-assets.cjs');

const source = process.argv[2];
assert(source, 'Pass the FModel VCT26Season export directory.');
const input = path.join(source, 'Anims');
const output = path.resolve(__dirname, '../app/site/aim-viewmodel');
const read = name => JSON.parse(fs.readFileSync(path.join(output, name + '.json')));
const write = (name, pack) => {
  fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify({ ...pack.manifest, offsets: pack.offsets }));
  fs.writeFileSync(path.join(output, name + '.bin'), pack.bytes);
};

const prefix = 'FP_Core_Melee_VCT26Season_';
const base = read('champions-2024-blade');
const baseBytes = fs.readFileSync(path.join(output, 'champions-2024-blade.bin'));
// Lv1 preserves the material split that the Lv2 GLB collapses into its gold primitive.
const glb = readGlb(path.join(source, 'Models/EQ_Melee_VCT26Season_Lv1_Skelmesh.glb'));
const bones = glb.json.skins[0].joints.map(i => glb.json.nodes[i].name);
assert.deepEqual(bones, ['Skeleton', 'Root']);
assert.equal(glb.json.nodes[2].translation, undefined);
assert.equal(glb.json.nodes[2].rotation, undefined);
const materials = new Map([['Melee_VCT26Season_MI', 0], ['Melee_VCT26Season_Gold_MI', 1], ['VCT26Season_Decals_MI', 2]]);
const mesh = arrays();
addGlb(mesh, glb, bones, materials);
const gun = packMesh(mesh);
assert.equal(gun.meta.tris, 4232);
assert.equal(gun.meta.groups.find(group => group.materialIndex === 2).count, 168 * 3);
const tangents = glb.json.meshes[0].primitives.flatMap(primitive =>
  accessor(glb, primitive.attributes.TANGENT).flatMap(([x, y, z, sign]) => [x, -z, y, sign]));
assert.equal(tangents.length, gun.meta.verts * 4);
const skeleton = { names: bones, parents: [-1, 0], t: [0, 0, 0, 0, 0, 0], q: [...base.gun.skeleton.q.slice(0, 4), 0, 0, 0, 1] };

const outline = readGlb(path.join(source, 'Models/EQ_Melee_VCT26Season_Outline.glb'));
const [primitive] = outline.json.meshes[0].primitives;
const outlinePositions = accessor(outline, primitive.attributes.POSITION);
const outlineNormals = accessor(outline, primitive.attributes.NORMAL);
const outlineUvs = accessor(outline, primitive.attributes.TEXCOORD_0);
const outlineIndices = accessor(outline, primitive.indices).flat();
// Include the Lv3 skin's -90-degree socket roll in the source-to-viewmodel basis conversion.
const outlineBytes = Buffer.concat([
  Buffer.from(Float32Array.from(outlinePositions.flatMap(([x, y, z]) => [100 * z, 100 * x, 100 * y])).buffer),
  Buffer.from(Float32Array.from(outlineNormals.flatMap(([x, y, z]) => [z, x, y])).buffer),
  Buffer.from(Float32Array.from(outlineUvs.flat()).buffer),
  Buffer.from(Uint16Array.from(outlineIndices).buffer)
]);

const clip = name => convert(path.join(input, prefix + name + '.psa'), base.arms.skeleton);
const montage = name => {
  const data = JSON.parse(fs.readFileSync(path.join(input, prefix + name + '_Montage.json')))[0].Properties;
  const [track] = data.SlotAnimTracks;
  const [segment] = track.AnimTrack.AnimSegments;
  assert.equal(track.AnimTrack.AnimSegments.length, 1);
  assert.equal(segment.AnimStartTime, 0);
  const sequence = segment.AnimReference.ObjectPath.split('/').pop().split('.')[0];
  assert(sequence.startsWith(prefix));
  const { spec, bytes } = clip(sequence.slice(prefix.length));
  assert(Math.abs(spec.duration - segment.AnimEndTime) < .001);
  return { spec: { ...spec, length: data.SequenceLength, rate: segment.AnimPlayRate,
    blendIn: data.BlendIn?.BlendTime ?? .25, blendOut: data.BlendOut?.BlendTime ?? .25,
    additiveDisable: [[0, 1, 'Linear', 0, 0]] }, bytes };
};

const idle = clip('IdlePose');
const attack1 = clip('Attack1');
const gunIdle = Buffer.from(Float32Array.from(bones.flatMap((_, i) =>
  [...skeleton.t.slice(i * 3, i * 3 + 3), ...skeleton.q.slice(i * 4, i * 4 + 4), 1, 1, 1])).buffer);
const blocks = pack([
  ['gun.mesh', gun.blob], ['gun.tangents', Buffer.from(Float32Array.from(tangents).buffer)],
  ['gunAura.mesh', outlineBytes],
  ...['arms.mesh', 'armsWalk.anim'].map(key => {
    const [at, size] = base.offsets[key];
    return [key, baseBytes.subarray(at, at + size)];
  }),
  ['armsIdle.anim', idle.bytes], ['armsFire.anim', attack1.bytes], ['gunIdle.anim', gunIdle]
]);
const animations = { armsIdle: idle.spec, armsFire: attack1.spec, armsWalk: base.anims.armsWalk,
  gunIdle: { format: 'trs32', frames: 1, duration: 1, bones: [0, 1], hold: [] } };
const equip = montage('Equip');
const equipPack = pack([['arms.anim', equip.bytes]]);
const motions = Object.fromEntries([
  ...[1, 2, 3, 4, 5].map(i => ['attack' + i, montage('Attack' + i + '_Lv2')]),
  ['heavy', montage('Attack_Alt_Lv2')], ['inspect', montage('Inspect_Lv2')]
]);
const motionPack = pack(Object.entries(motions).map(([name, { bytes }]) => [name + '.anim', bytes]));
const locomotion = read('champions-2024-blade.motions');
const locoBytes = fs.readFileSync(path.join(output, 'champions-2024-blade.motions.bin'));
const motionBlocks = pack([
  ...Object.entries(motionPack.offsets).map(([key, [at, size]]) => [key, motionPack.bytes.subarray(at, at + size)]),
  ...Object.keys(locomotion.additives).flatMap(name => [name + '.anim', name + '.hold']).map(key => {
    const [at, size] = locomotion.offsets[key];
    return [key, locoBytes.subarray(at, at + size)];
  })
]);

execFileSync('pwsh', ['-NoProfile', '-File', path.resolve(__dirname, '../scripts/build-kuronami-textures.ps1'),
  '-SigilExport', path.resolve(source)], { stdio: 'inherit' });

const family = 'vct-2026-sigil';
const shared = path.resolve(source, '../../_Core/Materials/SpecialMaterials');
const copy = (file, name) => fs.copyFileSync(file, path.join(output, family + '-' + name));
copy(path.join(shared, 'VCT26Season/VCT26Season_Gold_HDRI.hdr'), 'gold.hdr');
copy(path.join(shared, 'Magepunk3/Magepunk3_HDRI_FirstPerson_Glass.hdr'), 'glass.hdr');
const vfxMaps = path.resolve(source, '../Esportsinvitational/VFX/Textures');
copy(path.join(vfxMaps, 'Esports_Melee_GlowingLine_Mask_Tex.png'), 'outline-smoke.png');
copy(path.join(vfxMaps, 'Esports_Melee_GlowingLine_Mask_Tex_01.png'), 'outline-scroll.png');

function readMaterial(file) {
  const data = JSON.parse(fs.readFileSync(file));
  if (!Array.isArray(data)) return { ...data.Scalars, ...data.Colors, ...data.Textures };
  const spec = data[0].Properties;
  return Object.fromEntries([
    ...spec.ScalarParameterValues ?? [], ...spec.VectorParameterValues ?? [], ...spec.TextureParameterValues ?? []
  ].map(parameter => [parameter.ParameterInfo.Name, parameter.ParameterValue]));
}

function surface(stem, params, alphaCutoff = 0, defaults = {}) {
  return {
    baseColorTexture: false, normalTexture: false, normalScale: 1, normalScaleY: -1,
    baseColorFactor: [1, 1, 1, 1], roughness: 1, metalness: 1,
    emissiveFactor: [1, 1, 1], alphaMode: alphaCutoff ? 'MASK' : 'OPAQUE', alphaCutoff, doubleSided: false,
    materialMaps: { map: stem + '-color.png', normalMap: stem + '-normal.png', aoMap: stem + '-aem.png',
      roughnessMap: stem + '-mrs.png', metalnessMap: stem + '-mrs.png' },
    sigilSurface: {
      emission: params['Emissive Intensity'] ?? defaults.emission ?? 0,
      environment: params.HDRI?.ObjectName.includes('Glass') ? 'glass' : params.HDRI ? 'gold' : null,
      rotation: params['HDRI Rotation Angle'] ?? 0
    },
    envMapIntensity: params['HDRI Strength'] ?? .7
  };
}

const decal = readMaterial(path.join(shared, 'VCT26Season/VCT26Season_Decals_MI.json'));
const variants = [['standard', ''], ['purple-red', 'v1'], ['pacific', 'v2'], ['americas', 'v3'], ['green', 'v4']];
for (const [color, chroma] of variants) {
  const stem = family + '-' + color;
  const dir = chroma ? path.join(source, 'Chromas', chroma, 'Materials') : path.join(source, 'Materials');
  const suffix = chroma ? '_' + chroma : '';
  const body = readMaterial(path.join(dir, 'Melee_VCT26Season' + suffix + '_MI.json'));
  const metal = readMaterial(path.join(dir, 'Melee_VCT26Season_Gold' + suffix + '_MI.json'));
  const shell = readMaterial(path.join(dir, chroma ? '1P_VCT26Season_Outline' + suffix + '_MI.json' : '1P_VCT25Season_Outline_MI.json'));
  const { R, G, B } = shell.Emissive;
  const outlineSpec = {
    verts: outlinePositions.length, indices: outlineIndices.length,
    color: [R, G, B].map(channel => channel / Math.max(R, G, B)),
    near: shell['Outline Thickness Near'], far: shell['Outline Thickness Far'],
    distance: shell.Distance, speed: shell.SmokePanningSpeed
  };
  const manifest = {
    toViewQuat: base.toViewQuat, camera: base.camera, attach: base.attach,
    gun: { ...gun.meta, skeleton, texture: stem + '-color.png', tangentOffset: blocks.offsets['gun.tangents'][0] },
    arms: base.arms, anims: animations,
    skinMaterials: [surface(stem, body, 0, { emission: 5 }), surface(stem, metal), surface(family + '-decals', decal, .3333)],
    skin: { id: stem, name: 'VCT 2026 Sigil', armsReplaced: false, viewEnvironment: 'studio-steel-v1' }
  };
  const writeManifest = (id, spec) =>
    fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify({ ...spec, offsets: blocks.offsets }));
  writeManifest(stem, manifest);
  writeManifest(stem + '-mvp', {
    ...manifest, skin: { ...manifest.skin, id: stem + '-mvp' },
    gun: { ...manifest.gun, sigilOutline: outlineSpec }
  });
}
fs.writeFileSync(path.join(output, family + '.bin'), blocks.bytes);
write(family + '.equip', { ...equipPack, manifest: { readySeconds: .6, arms: equip.spec } });
write('vct-2026-sigil.motions', { ...motionBlocks, manifest: {
  additives: locomotion.additives, attachBone: 'R_WeaponPoint',
  montages: Object.fromEntries(Object.entries(motions).map(([name, { spec }]) => [name, spec])),
  tScale: locomotion.tScale, qScale: locomotion.qScale, timing: { ...locomotion.timing, comboNumber: 5 }
} });


