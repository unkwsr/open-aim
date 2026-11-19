const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
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
function addGlb(target, glb, bones, materials) {
  const sourceBones = glb.json.skins?.[0]?.joints.map(i => glb.json.nodes[i].name);
  for (const prim of glb.json.meshes[0].primitives) {
    const materialName = glb.json.materials[prim.material]?.name;
    const materialIndex = materials.get(materialName);
    if (materialIndex === undefined) throw Error(`Unmapped material ${materialName} in ${glb.file}`);
    const at = prim.attributes;
    const pos = accessor(glb, at.POSITION), norm = accessor(glb, at.NORMAL);
    const uv = accessor(glb, at.TEXCOORD_0), index = accessor(glb, prim.indices);
    const joints = accessor(glb, at.JOINTS_0);
    const weights = accessor(glb, at.WEIGHTS_0);
    const startVertex = target.position.length, startIndex = target.indices.length;
    for (let i = 0; i < pos.length; i++) {
      target.position.push([100 * pos[i][0], -100 * pos[i][2], 100 * pos[i][1]]);
      target.normal.push([norm[i][0], -norm[i][2], norm[i][1]]);
      target.uv.push(uv[i]);
      const pairs = joints[i].map((joint, slot) => ({ bone: bones.indexOf(sourceBones[joint]), weight: weights[i][slot] }));
      for (const pair of pairs) if (pair.bone < 0) throw Error(`Unmapped source bone in ${glb.file}`);
      const sum = pairs.reduce((n, pair) => n + pair.weight, 0);
      if (!(sum > 0)) throw Error(`Zero skin weights in ${glb.file}`);
      const quant = pairs.map(pair => Math.round(pair.weight * 255 / sum));
      quant[pairs.findIndex(pair => pair.weight === Math.max(...pairs.map(x => x.weight)))] += 255 - quant.reduce((a, b) => a + b, 0);
      target.joints.push(pairs.map(pair => pair.bone));
      target.weights.push(quant);
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

function convert(file, skeleton) {
  const name = path.basename(file, '.psa');
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

module.exports = { readGlb, accessor, arrays, addGlb, packMesh, convert, pack };
