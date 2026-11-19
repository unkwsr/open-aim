const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readGlb, accessor, arrays, addGlb, packMesh, convert, pack } = require('./valorant-melee-assets.cjs');

const root = path.resolve(__dirname, '..');
const exportRoot = path.resolve(process.argv[2] ?? path.join(root,
  'exports/champions-2021-karambit/ShooterGame/Content/Equippables/Melee'));
const champions = path.join(exportRoot, 'Champions');
const sharedAnims = path.join(exportRoot, 'S0/1P/Anims');
const output = path.join(root, 'app/site/aim-viewmodel');
const stem = 'champions-2021-karambit';
const read = (name, ext) => fs.readFileSync(path.join(output, name + ext));
const base = JSON.parse(read('vct-2026-sigil-green', '.json'));
const baseBytes = read('vct-2026-sigil-green', '.bin');
const locomotion = JSON.parse(read('vct-2026-sigil.motions', '.json'));
const locomotionBytes = read('vct-2026-sigil.motions', '.bin');

const glb = readGlb(path.join(champions, 'Models/EQ_Melee_Champions_Lv1_Skelmesh.glb'));
const skeleton = base.gun.skeleton;
const jointNodes = glb.json.skins[0].joints.map(index => glb.json.nodes[index]);
assert.deepEqual(jointNodes.map(node => node.name), skeleton.names);
assert.deepEqual(jointNodes[0].children, [glb.json.skins[0].joints[1]]);
assert(!jointNodes[1].translation && !jointNodes[1].rotation && !jointNodes[1].scale);
const mesh = arrays();
addGlb(mesh, glb, skeleton.names, new Map([['Melee_Champions_MI', 0]]));
const gun = packMesh(mesh);
const outline = readGlb(path.join(champions, 'Models/EQ_Melee_Champions_Outline.glb'));
const [shell] = outline.json.meshes[0].primitives;
const positions = accessor(outline, shell.attributes.POSITION);
const normals = accessor(outline, shell.attributes.NORMAL);
const indices = accessor(outline, shell.indices).flat();
const outlineBuffer = Buffer.concat([
  Buffer.from(Float32Array.from(positions.flatMap(([x, y, z]) => [100 * x, -100 * z, 100 * y])).buffer),
  Buffer.from(Float32Array.from(normals.flatMap(([x, y, z]) => [x, -z, y])).buffer),
  Buffer.from(Uint16Array.from(indices).buffer)
]);
const fresnel = JSON.parse(fs.readFileSync(path.resolve(exportRoot,
  '../Guns/Rifles/AK/Champions/Models/Champions_Fresnel_Inst.json')));
const { R, G, B } = fresnel.Colors.Emissive;
const aura = {
  verts: positions.length, indices: indices.length, color: [1, G / R, B / R],
  near: fresnel.Scalars['Outline Thickness Near'], far: fresnel.Scalars['Outline Thickness Far'],
  distance: fresnel.Scalars.Distance
};

function clip(name) {
  const animation = convert(path.join(sharedAnims, 'FP_Core_Melee_Karambit_S0_' + name + '.psa'), base.arms.skeleton);
  return { ...animation, spec: { ...animation.spec, rig: 'arms' } };
}
const disableLocomotion = [[0, 1, 'Linear', 0, 0]];
const montage = (animation, blendIn, blendOut) => ({
  bytes: animation.bytes,
  spec: { ...animation.spec, length: animation.spec.duration, blendIn, blendOut, additiveDisable: disableLocomotion }
});

const inspectName = 'FP_Core_Melee_Karambit_Champions_InspectLoop_Montage';
const inspectSource = JSON.parse(fs.readFileSync(path.join(champions, '1P/Anims', inspectName + '.json')))[0].Properties;
const [introSegment, loopSegment] = inspectSource.SlotAnimTracks[0].AnimTrack.AnimSegments;
const segments = [introSegment, loopSegment].map(segment => {
  const name = segment.AnimReference.ObjectPath.split('/').pop().split('.')[0];
  const animation = convert(path.join(sharedAnims, name + '.psa'), base.arms.skeleton);
  assert.equal(segment.AnimStartTime, 0);
  assert.equal(segment.AnimPlayRate, 1);
  assert(Math.abs(animation.spec.duration - segment.AnimEndTime) < .001);
  return animation;
});
const [intro, loop] = segments;
// Play both source segments once. They share a boundary frame at 60 Hz.
const frameBytes = intro.bytes.length / intro.spec.frames;
const inspect = montage({
  bytes: Buffer.concat([intro.bytes.subarray(0, -frameBytes), loop.bytes]),
  spec: { ...intro.spec, source: inspectName, frames: intro.spec.frames + loop.spec.frames - 1,
    duration: inspectSource.SequenceLength }
}, inspectSource.BlendIn.BlendTime, inspectSource.BlendOut.BlendTime);

function block(blob, offsets, key) {
  const [start, size] = offsets[key];
  return [key, blob.subarray(start, start + size)];
}

const idle = clip('IdlePose');
const attacks = [1, 2, 3, 4].map(number => montage(clip('Attack' + number), .08, .18));
const motions = {
  ...Object.fromEntries(attacks.map((attack, index) => ['attack' + (index + 1), attack])),
  heavy: montage(clip('Attack_Alt'), .08, .18),
  inspect
};
const gunIdle = Buffer.from(Float32Array.from(skeleton.names.flatMap((_, index) =>
  [...skeleton.t.slice(index * 3, index * 3 + 3), ...skeleton.q.slice(index * 4, index * 4 + 4), 1, 1, 1])).buffer);
const equip = clip('Equip');
const color = stem + '-color.png';
const material = {
  baseColorTexture: true, normalTexture: true, normalScale: 1,
  baseColorFactor: [1, 1, 1, 1], roughness: .9, metalness: .9,
  emissiveFactor: [0, 0, 0], alphaMode: 'OPAQUE', doubleSided: false,
  materialMaps: { map: color, normalMap: stem + '-normal.png', aoMap: stem + '-orm.png',
    roughnessMap: stem + '-orm.png', metalnessMap: stem + '-orm.png' }, envMapIntensity: 1.15
};

execFileSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/build-kuronami-textures.ps1'),
  '-ChampionsKarambitExport', champions], { stdio: 'inherit' });

function write(suffix, manifest, blocks) {
  const { bytes, offsets } = pack(blocks);
  fs.writeFileSync(path.join(output, stem + suffix + '.bin'), bytes);
  fs.writeFileSync(path.join(output, stem + suffix + '.json'), JSON.stringify({ ...manifest, offsets }));
}

write('', {
  toViewQuat: base.toViewQuat, camera: base.camera, attach: base.attach,
  gun: { ...gun.meta, skeleton, texture: color, aura }, arms: base.arms,
  skinMaterials: [material], skin: { id: stem, name: 'Champions 2021 Karambit', viewEnvironment: 'studio-steel-v1' },
  anims: { armsIdle: idle.spec, armsFire: attacks[0].spec, armsWalk: base.anims.armsWalk,
    gunIdle: { format: 'trs32', frames: 1, duration: 1, bones: [0, 1] } }
}, [
  ['gun.mesh', gun.blob], ['gunAura.mesh', outlineBuffer], ['gunIdle.anim', gunIdle],
  ['armsIdle.anim', idle.bytes], ['armsFire.anim', attacks[0].bytes],
  ...['arms.mesh', 'armsWalk.anim'].map(key => block(baseBytes, base.offsets, key))
]);
write('.equip', { readySeconds: .6, arms: { ...equip.spec, rate: 1, blendOut: .1 } }, [['arms.anim', equip.bytes]]);
write('.motions', {
  additives: locomotion.additives, attachBone: base.attach.bone, tScale: locomotion.tScale, qScale: locomotion.qScale,
  timing: { ...locomotion.timing, comboNumber: attacks.length },
  montages: Object.fromEntries(Object.entries(motions).map(([name, animation]) => [name, animation.spec]))
}, [
  ...Object.entries(motions).map(([name, animation]) => [name + '.anim', animation.bytes]),
  ...Object.keys(locomotion.additives).flatMap(name => [name + '.anim', name + '.hold'])
    .map(key => block(locomotionBytes, locomotion.offsets, key))
]);
