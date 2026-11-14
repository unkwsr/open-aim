// Minimal .glb reader for FModel mesh exports: first mesh, all primitives merged -> {pos, nrm, uv, idx} (glTF axes/units).
import fs from 'node:fs';
const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
export function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ': not a glb');
  let off = 12, json = null, bin = null;
  while (off < b.length) { const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4); const chunk = b.subarray(off + 8, off + 8 + len); if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')); else if (type === 0x004e4942) bin = chunk; off += 8 + len; }
  const read = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = SIZE[a.type], T = COMP[a.componentType]; const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = v.byteStride ?? n * T.BYTES_PER_ELEMENT; const out = []; const dv = new DataView(bin.buffer, bin.byteOffset); for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const o = start + k * stride + c * T.BYTES_PER_ELEMENT; out.push(T === Float32Array ? dv.getFloat32(o, true) : T === Uint16Array ? dv.getUint16(o, true) : T === Uint32Array ? dv.getUint32(o, true) : T === Uint8Array ? dv.getUint8(o) : T === Int16Array ? dv.getInt16(o, true) : dv.getInt8(o)); } return out; };
  const mesh = json.meshes[0], m = { pos: [], nrm: [], uv: [], idx: [] };
  for (const p of mesh.primitives) {
    const base = m.pos.length / 3, pos = read(p.attributes.POSITION);
    m.pos.push(...pos);
    m.nrm.push(...(p.attributes.NORMAL !== undefined ? read(p.attributes.NORMAL) : new Array(pos.length).fill(0)));
    m.uv.push(...(p.attributes.TEXCOORD_0 !== undefined ? read(p.attributes.TEXCOORD_0) : new Array(pos.length / 3 * 2).fill(0)));
    const idx = p.indices !== undefined ? read(p.indices) : [...Array(pos.length / 3).keys()];
    m.idx.push(...idx.map((i) => i + base));
  }
  return m;
}
