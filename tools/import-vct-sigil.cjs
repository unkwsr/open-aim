const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readPsa } = require('../previews/bot-anims/psa.cjs');

function readGlb(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw Error(`Invalid GLB: ${file}`);
  const jsonSize = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonSize));
  const binAt = 20 + jsonSize;
  if (buffer.toString('ascii', binAt + 4, binAt + 8) !== 'BIN\0') throw Error(`Missing GLB binary: ${file}`);
  return { json, binary: buffer.subarray(binAt + 8, binAt + 8 + buffer.readUInt32LE(binAt)), file };
}

function accessor(glb, id) {
  const a = glb.json.accessors[id], v = glb.json.bufferViews[a.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const offset = (v.byteOffset || 0) + (a.byteOffset || 0);
  const stride = v.byteStride || width * bytes;
  const read = { 5121: 'readUInt8', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[a.componentType];
  if (!read || !width) throw Error(`Unsupported accessor ${id} in ${glb.file}`);
  return Array.from({ length: a.count }, (_, i) =>
    Array.from({ length: width }, (_, j) => glb.binary[read](offset + i * stride + j * bytes)));
}

const arrays = () => ({ position: [], normal: [], uv: [], joints: [], weights: [], indices: [], groups: [] });
function addGlb(target, glb, fixedBone = null, shift = [0, 0, 0]) {
  const sourceBones = glb.json.skins?.[0]?.joints.map(i => glb.json.nodes[i].name);
  for (const prim of glb.json.meshes[0].primitives) {
    const materialName = glb.json.materials[prim.material]?.name;
    const materialIndex = materials.get(materialName);
    if (materialIndex === undefined) throw Error(`Unmapped material ${materialName} in ${glb.file}`);
    const at = prim.attributes;
    const pos = accessor(glb, at.POSITION), norm = accessor(glb, at.NORMAL);
    const uv = accessor(glb, at.TEXCOORD_0), index = accessor(glb, prim.indices);
    const joints = fixedBone ? null : accessor(glb, at.JOINTS_0);
    const weights = fixedBone ? null : accessor(glb, at.WEIGHTS_0);
    const startVertex = target.position.length, startIndex = target.indices.length;
    for (let i = 0; i < pos.length; i++) {
      target.position.push([100 * pos[i][0] + shift[0], -100 * pos[i][2] + shift[1], 100 * pos[i][1] + shift[2]]);
      target.normal.push([norm[i][0], -norm[i][2], norm[i][1]]);
      target.uv.push(uv[i]);
      if (fixedBone) {
        target.joints.push([bones.indexOf(fixedBone), 0, 0, 0]);
        target.weights.push([255, 0, 0, 0]);
      } else {
        const pairs = joints[i].map((joint, slot) => ({ bone: bones.indexOf(sourceBones[joint]), weight: weights[i][slot] }));
        for (const pair of pairs) if (pair.bone < 0) throw Error(`Unmapped source bone in ${glb.file}`);
        const sum = pairs.reduce((n, pair) => n + pair.weight, 0);
        if (!(sum > 0)) throw Error(`Zero skin weights in ${glb.file}`);
        const quant = pairs.map(pair => Math.round(pair.weight * 255 / sum));
        quant[pairs.findIndex(pair => pair.weight === Math.max(...pairs.map(x => x.weight)))] += 255 - quant.reduce((a, b) => a + b, 0);
        target.joints.push(pairs.map(pair => pair.bone));
        target.weights.push(quant);
      }
    }
    for (const [i] of index) target.indices.push(startVertex + i);
    target.groups.push({ start: startIndex, count: index.length, materialIndex });
  }
}

function packMesh(mesh) {
  const verts = mesh.position.length, indices = mesh.indices.length;
  if (verts >= 65536) throw Error('16-bit index limit exceeded');
  if (![mesh.normal, mesh.uv, mesh.joints, mesh.weights].every(a => a.length === verts)) throw Error('Vertex array length mismatch');
  const chunks = [];
  for (const key of ['position', 'normal', 'uv']) {
    const width = key === 'uv' ? 2 : 3, b = Buffer.alloc(verts * width * 4);
    mesh[key].forEach((row, i) => row.forEach((v, j) => b.writeFloatLE(v, (i * width + j) * 4)));
    chunks.push(b);
  }
  for (const key of ['joints', 'weights']) {
    const b = Buffer.alloc(verts * 4);
    mesh[key].forEach((row, i) => row.forEach((v, j) => {
      if (!Number.isInteger(v) || v < 0 || v > 255) throw Error(`Invalid ${key}: ${v}`);
      b[i * 4 + j] = v;
    }));
    chunks.push(b);
  }
  const b = Buffer.alloc(indices * 2);
  mesh.indices.forEach((v, i) => b.writeUInt16LE(v, i * 2));
  chunks.push(b);
  return { blob: Buffer.concat(chunks), meta: { verts, tris: indices / 3, groups: mesh.groups } };
}

function convert(name, skeleton) {
  const file = path.join(input, name + '.psa');
  const source = readPsa(file);
  assert.equal(source.sequences.length, 1, name);
  assert.equal(source.frames, source.sequences[0].frames, name);
  const duration = source.frames / source.sequences[0].rate;
  const buffer = fs.readFileSync(file);
  let scaleOffset;
  for (let at = 0; at < buffer.length;) {
    const size = buffer.readInt32LE(at + 24), count = buffer.readInt32LE(at + 28);
    assert(size >= 0 && count >= 0 && at + 32 + size * count <= buffer.length, name);
    if (buffer.toString('latin1', at, at + 20).split('\0')[0] === 'SCALEKEYS') {
      assert.equal(size, 16);
      assert.equal(count, source.frames * source.bones.length);
      scaleOffset = at + 32;
    }
    at += 32 + size * count;
  }
  assert(scaleOffset, name + ' is missing scale keys');
  const indices = new Map(source.bones.map((bone, index) => [bone.name, index]));
  const map = skeleton.names.map((bone, index) => {
    const from = indices.get(bone);
    assert(from !== undefined, name + ' missing ' + bone);
    assert.equal(source.bones[source.bones[from].parent]?.name, skeleton.names[skeleton.parents[index]], bone);
    return from;
  });
  const data = new Float32Array(source.frames * map.length * 10);
  for (let frame = 0; frame < source.frames; frame++) {
    for (let i = 0; i < map.length; i++) {
      const from = map[i], key = frame * source.bones.length + from;
      const t = Array.from(source.pos.subarray(key * 3, key * 3 + 3));
      const q = Array.from(source.quat.subarray(key * 4, key * 4 + 4));
      // ActorX stores the non-root rotations with the opposite quaternion convention.
      if (source.bones[from].parent >= 0) q[3] = -q[3];
      const norm = Math.hypot(...q);
      assert(norm > 0, name);
      const rotation = q.map(value => value / norm);
      if (i === 0 && frame === 0) {
        const dot = rotation.reduce((sum, value, k) => sum + value * skeleton.q[k], 0);
        assert(Math.abs(dot) > .9999, name + ' uses a different scene-root basis');
      }
      const scale = [0, 4, 8].map(offset => buffer.readFloatLE(scaleOffset + key * 16 + offset));
      const pose = [...t, ...rotation, ...scale];
      assert(pose.every(Number.isFinite), name + ' has invalid keys');
      data.set(pose, (frame * map.length + i) * 10);
    }
  }
  return {
    spec: { source: name, frames: source.frames, duration, format: 'trs32', bones: map.map((_, index) => index), hold: [] },
    bytes: Buffer.from(data.buffer)
  };
}

function pack(entries) {
  const parts = [], offsets = {};
  let at = 0;
  for (const [name, bytes] of entries) {
    const pad = (4 - at % 4) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    at += pad;
    offsets[name] = [at, bytes.length];
    parts.push(bytes);
    at += bytes.length;
  }
  return { offsets, bytes: Buffer.concat(parts) };
}


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
const glb = readGlb(path.join(source, 'Models/EQ_Melee_VCT26Season_Lv2_Skelmesh.glb'));
const bones = glb.json.skins[0].joints.map(i => glb.json.nodes[i].name);
assert.deepEqual(bones, ['Skeleton', 'Root']);
assert.equal(glb.json.nodes[2].translation, undefined);
assert.equal(glb.json.nodes[2].rotation, undefined);
const materials = new Map([['Melee_VCT26Season_MI', 0], ['Melee_VCT26Season_Gold_MI', 1]]);
const mesh = arrays();
addGlb(mesh, glb);
const gun = packMesh(mesh);
const skeleton = { names: bones, parents: [-1, 0], t: [0, 0, 0, 0, 0, 0], q: [...base.gun.skeleton.q.slice(0, 4), 0, 0, 0, 1] };

const clip = name => convert(prefix + name, base.arms.skeleton);
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
  ['gun.mesh', gun.blob],
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
for (const color of ['purple-red', 'green']) {
  const stem = 'vct-2026-sigil-' + color;
  const material = {
    baseColorTexture: true, normalTexture: true, normalScale: 1,
    baseColorFactor: [1, 1, 1, 1], roughness: 1, metalness: .8,
    emissiveFactor: [0, 0, 0], alphaMode: 'OPAQUE', doubleSided: false,
    materialMaps: { map: stem + '-color.png', normalMap: stem + '-normal.png', aoMap: stem + '-orm.png',
      roughnessMap: stem + '-orm.png', metalnessMap: stem + '-orm.png' }, envMapIntensity: 1.15
  };
  const manifest = {
    toViewQuat: base.toViewQuat, camera: base.camera, attach: base.attach,
    gun: { ...gun.meta, skeleton, texture: stem + '-color.png' }, arms: base.arms, anims: animations,
    skinMaterials: [material, { ...material, roughness: .85, metalness: 1, envMapIntensity: 1.35 }],
    skin: { id: stem, name: 'VCT 2026 Sigil', armsReplaced: false, viewEnvironment: 'studio-steel-v1' }
  };
  write(stem, { ...blocks, manifest });
  write(stem + '.equip', { ...equipPack, manifest: { readySeconds: .6, arms: equip.spec } });
}
write('vct-2026-sigil.motions', { ...motionBlocks, manifest: {
  additives: locomotion.additives, attachBone: 'R_WeaponPoint',
  montages: Object.fromEntries(Object.entries(motions).map(([name, { spec }]) => [name, spec])),
  tScale: locomotion.tScale, qScale: locomotion.qScale, timing: { ...locomotion.timing, comboNumber: 5 }
} });


