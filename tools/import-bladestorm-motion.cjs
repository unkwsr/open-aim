const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { readPsa } = require('../previews/bot-anims/psa.cjs');
const root = path.resolve(__dirname, '..');
const content = process.argv[2];
assert(content, 'Pass the exported ShooterGame/Content directory');
const wushu = path.join(content, 'Characters/Wushu/S0');
const anims = path.join(wushu, 'Ability_X/1P/Anims');
const models = path.join(root, 'app/site/aim-viewmodel');
const tracer = path.join(root, 'app/site/aim-tracers');
const backup = path.join(root, 'previews/bladestorm-motion/before');
fs.mkdirSync(backup, { recursive: true });

function chunks(file) {
  const buffer = fs.readFileSync(file), sections = new Map();
  for (let at = 0; at < buffer.length;) {
    const type = buffer.toString('ascii', at, at + 20).split('\0')[0];
    const size = buffer.readInt32LE(at + 24), count = buffer.readInt32LE(at + 28);
    const start = at + 32;
    assert(size >= 0 && count >= 0 && start + size * count <= buffer.length, file);
    sections.set(type, { size, count, start });
    at = start + size * count;
  }
  return { buffer, sections };
}

function encode(clip, skeleton, named = false) {
  const file = path.join(anims, clip.source + '.psa');
  const source = readPsa(file);
  const { buffer, sections } = chunks(file), scales = sections.get('SCALEKEYS');
  const map = skeleton.names.map((name, i) => {
    const from = source.bones.findIndex(bone => bone.name === name);
    assert(from >= 0 && source.bones[source.bones[from].parent]?.name === skeleton.names[skeleton.parents[i]], name);
    return from;
  });
  // Preserve the shipped single-frame base pose and full exported action clips.
  const frames = clip.frames === 1 ? 1 : source.frames;
  const data = new Float32Array(frames * map.length * 10);
  for (let frame = 0; frame < frames; frame++) for (let i = 0; i < map.length; i++) {
    const index = map[i], key = frame * source.bones.length + index;
    const q = Array.from(source.quat.subarray(key * 4, key * 4 + 4));
    if (source.bones[index].parent >= 0) q[3] = -q[3];
    const length = Math.hypot(...q);
    assert(length > 0, clip.source);
    const scale = scales ? [0,4,8].map(offset => buffer.readFloatLE(scales.start + key * scales.size + offset)) : [1,1,1];
    const values = [...source.pos.subarray(key * 3, key * 3 + 3), ...q.map(value => value / length), ...scale];
    assert(values.every(Number.isFinite), clip.source);
    data.set(values, (frame * map.length + i) * 10);
  }
  return { spec: { ...clip, format: 'trs32', frames, hold: [], bones: named ? skeleton.names : map.map((_, i) => i) }, bytes: Buffer.from(data.buffer) };
}

const baseline = name => {
  const saved = path.join(backup, name);
  return fs.existsSync(saved) ? saved : path.join(models, name);
};
const read = name => JSON.parse(fs.readFileSync(baseline(name + '.json'), 'utf8'));
const model = read('bladestorm'), equip = read('bladestorm.equip');
const montage = name => {
  const properties = JSON.parse(fs.readFileSync(path.join(anims, name + '_Montage.json'), 'utf8'))[0].Properties;
  return { in: properties.BlendIn?.BlendTime ?? 0, out: properties.BlendOut?.BlendTime ?? 0, seconds: properties.SequenceLength };
};
model.bladeStormMotion = {
  throws: Array.from({ length: 5 }, (_, i) => {
    const take = String(i + 1).padStart(2, '0');
    return { arms: montage('FP_Wushu_S0_X_Attack' + take), knives: montage('AB_Wushu_S0_X_Attack' + take) };
  }),
  burst: montage('FP_Wushu_S0_X_RightClickAttack')
};

function repack(name, manifest, clips) {
  const old = fs.readFileSync(baseline(name + '.bin'));
  const entries = new Map(Object.entries(manifest.offsets).map(([key, [at, size]]) => [key, old.subarray(at, at + size)]));
  for (const [key, clip] of Object.entries(clips)) {
    // The generic walk path consumes the existing additive walk representation.
    if (key === 'armsWalk') continue;
    const rig = clip.rig ?? key;
    const result = encode(clip, model[rig].skeleton, !manifest.anims);
    clips[key] = result.spec;
    entries.set(key + '.anim', result.bytes);
  }
  const blocks = [], offsets = {};
  let length = 0;
  for (const [key, data] of entries) {
    const pad = (4 - length % 4) % 4;
    if (pad) blocks.push(Buffer.alloc(pad));
    length += pad;
    offsets[key] = [length, data.length];
    length += data.length;
    blocks.push(data);
  }
  if (!manifest.anims) Object.assign(manifest, clips);
  manifest.offsets = offsets;
  for (const [ext, data] of [['.bin', Buffer.concat(blocks)], ['.json', JSON.stringify(manifest)]]) {
    const target = path.join(models, name + ext), saved = path.join(backup, name + ext);
    if (!fs.existsSync(saved)) fs.copyFileSync(target, saved);
    fs.writeFileSync(target, data);
  }
}

repack('bladestorm', model, model.anims);
repack('bladestorm.equip', equip, {
  arms: { ...equip.arms, blendOut: montage(equip.arms.source).out },
  gun: { ...equip.gun, blendOut: montage(equip.gun.source).out }
});

const { buffer, sections } = chunks(path.join(content, 'VFX/Meshes/Swirl_A.pskx'));
const points = sections.get('PNTS0000'), wedges = sections.get('VTXW0000'), faces = sections.get('FACE0000');
assert(points?.count && wedges?.count && faces?.count);
const positions = [], uvs = [], indices = [];
for (let i = 0; i < wedges.count; i++) {
  const at = wedges.start + i * wedges.size, p = points.start + buffer.readUInt32LE(at) * points.size;
  positions.push(buffer.readFloatLE(p), buffer.readFloatLE(p + 4), buffer.readFloatLE(p + 8));
  uvs.push(buffer.readFloatLE(at + 4), 1 - buffer.readFloatLE(at + 8));
}
for (let i = 0; i < faces.count; i++) for (const offset of [0, 2, 4]) indices.push(buffer.readUInt16LE(faces.start + i * faces.size + offset));
const mesh = { positions, uvs, indices };
fs.writeFileSync(path.join(tracer, 'bladestorm-swirl.mjs'), 'export default ' + JSON.stringify(mesh) + ';\n');
fs.copyFileSync(path.join(wushu, 'VFX/Textures/Windril_TFX.png'), path.join(tracer, 'bladestorm-wind.png'));
console.log('Packed Blade Storm animation scale, montage timing, Windril texture and Swirl_A mesh.');
