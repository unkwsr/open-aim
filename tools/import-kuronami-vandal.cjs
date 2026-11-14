// Rebuild the existing Kuronami Vandal animation assets from local FModel exports.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { readPsa } = require('../previews/bot-anims/psa.cjs');

const root = path.resolve(__dirname, '..');
const input = process.argv[2];
assert(input, 'Usage: node tools/import-kuronami-vandal.cjs <AK/Ninja/Anims folder>');
const output = path.join(root, 'app/site/aim-viewmodel');
const stems = ['kuronami-vandal-white', 'kuronami-vandal-black-red'];

function convert(name, skeleton, duration) {
  const file = path.join(input, name + '.psa');
  const source = readPsa(file);
  assert.equal(source.sequences.length, 1, name);
  assert.equal(source.frames, source.sequences[0].frames, name);
  const actualDuration = source.frames / source.sequences[0].rate;
  assert(Math.abs(actualDuration - duration) < .001, name + ' does not match montage duration');
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

function build(stem) {
  const modelPath = path.join(output, stem);
  const model = JSON.parse(fs.readFileSync(modelPath + '.json'));
  const original = fs.readFileSync(modelPath + '.bin');
  const arms = model.arms.skeleton, gun = model.gun.skeleton;
  const equipArms = convert('FP_Core_AK_Ninja_Equip_Lv3', arms, 1.65);
  const equipGun = convert('GN_Core_AK_Ninja_Equip_Lv3', gun, 1.65);
  const equip = pack([['arms.anim', equipArms.bytes], ['gun.anim', equipGun.bytes]]);
  const equipManifest = {
    readySeconds: 1,
    arms: { ...equipArms.spec, rate: 1, blendOut: .1 },
    gun: { ...equipGun.spec, rate: 1, blendOut: .1 },
    offsets: equip.offsets
  };

  const clips = {
    armsReload: convert('FP_Core_AK_Ninja_Reload_Lv3', arms, 176 / 60),
    gunReload: convert('GN_Core_AK_Ninja_Reload_Lv3', gun, 176 / 60),
    gunFire: convert('GN_Core_AK_Ninja_Fire_Lv3', gun, 19 / 60),
    armsInspect: convert('FP_Core_AK_Ninja_Inspect_Montage_Lv3', arms, 250 / 60)
  };
  const idle = new Float32Array(gun.names.length * 10);
  for (let i = 0; i < gun.names.length; i++) {
    idle.set([...gun.t.slice(i * 3, i * 3 + 3), ...gun.q.slice(i * 4, i * 4 + 4), 1, 1, 1], i * 10);
  }
  clips.gunIdle = {
    spec: { source: 'Kuronami Vandal bind pose', frames: 1, duration: 1 / 60, format: 'trs32', bones: gun.names.map((_, i) => i), hold: [] },
    bytes: Buffer.from(idle.buffer)
  };
  const blocks = new Map(Object.entries(model.offsets).map(([name, [at, size]]) => [name, original.subarray(at, at + size)]));
  for (const [name, clip] of Object.entries(clips)) {
    model.anims[name] = clip.spec;
    blocks.set(name + '.anim', clip.bytes);
  }
  const updated = pack(blocks);
  model.offsets = updated.offsets;
  model.kuronamiVandalMotion = { reloadSeconds: 2.5, inspectBlendIn: .4, inspectBlendOut: .2 };
  return new Map([
    [stem + '.json', JSON.stringify(model)],
    [stem + '.bin', updated.bytes],
    [stem + '.equip.json', JSON.stringify(equipManifest)],
    [stem + '.equip.bin', equip.bytes]
  ]);
}

const files = stems.flatMap(stem => [...build(stem)]);
const backup = path.join(root, 'previews/kuronami-vandal/before');
fs.mkdirSync(backup, { recursive: true });
for (const [name, bytes] of files) {
  const target = path.join(output, name), saved = path.join(backup, name);
  if (!fs.existsSync(saved)) fs.copyFileSync(target, saved);
  fs.writeFileSync(target, bytes);
}
console.log('Built paired equip and reload tracks, weapon fire, and first-person inspect for both Kuronami Vandal asset sets.');
