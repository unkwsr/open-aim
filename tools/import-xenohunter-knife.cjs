const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readGlb, arrays, addGlb, packMesh, convert, pack } = require('./valorant-melee-assets.cjs');

const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || path.join(root, 'exports/xenohunter-knife/ShooterGame/Content/Equippables/Melee/Alien'));
const output = path.join(root, 'app/site/aim-viewmodel');
const stem = 'xenohunter-knife';
const read = name => JSON.parse(fs.readFileSync(path.join(output, name + '.json')));
const base = read('vct-2026-sigil-green');
const baseBytes = fs.readFileSync(path.join(output, 'vct-2026-sigil-green.bin'));
const locomotion = read('vct-2026-sigil.motions');
const locoBytes = fs.readFileSync(path.join(output, 'vct-2026-sigil.motions.bin'));
const glb = readGlb(path.join(source, 'Models/EQ_Melee_Alien_Lv1_Skelmesh.glb'));
const joints = glb.json.skins[0].joints.map(i => glb.json.nodes[i]);
assert.deepEqual(joints.map(n => n.name), ['Skeleton', 'Root', 'Cord']);
assert.deepEqual(joints[1].children, [glb.json.skins[0].joints[2]]);
// Convert GLB's Y-up bind positions and rotations to the packed Unreal basis.
const skeleton = { names: joints.map(n => n.name), parents: [-1, 0, 1],
  t: joints.flatMap(n => { const [x,y,z] = n.translation || [0,0,0]; return [100*x,-100*z,100*y]; }),
  q: joints.flatMap(n => { const [x,y,z,w] = n.rotation || [0,0,0,1]; return [x,-z,y,w]; }) };
const mesh = arrays();
addGlb(mesh, glb, skeleton.names, new Map([['Melee_Alien_MI', 0]]));
const gun = packMesh(mesh);
const prefix = 'FP_Core_Melee_Alien_';
const clip = name => convert(path.join(source, 'Anims', prefix + name + '.psa'), base.arms.skeleton);
function montage(name) {
  const data = JSON.parse(fs.readFileSync(path.join(source, 'Anims', prefix + name + '_Montage.json')))[0].Properties;
  const segments = data.SlotAnimTracks[0].AnimTrack.AnimSegments;
  assert.equal(segments.length, 1);
  const segment = segments[0];
  assert.equal(segment.AnimStartTime, 0);
  const sequence = segment.AnimReference.ObjectPath.split('/').pop().split('.')[0];
  const animation = clip(sequence.slice(prefix.length));
  // Inspect's montage trims the final eight frames of its longer source sequence.
  assert(animation.spec.duration + .001 >= segment.AnimEndTime);
  if (animation.spec.duration - segment.AnimEndTime > .001) {
    const frames = Math.round(segment.AnimEndTime * 60) + 1;
    assert(frames <= animation.spec.frames);
    animation.bytes = animation.bytes.subarray(0, frames * animation.bytes.length / animation.spec.frames);
    animation.spec = { ...animation.spec, frames, duration: segment.AnimEndTime };
  }
  return { bytes: animation.bytes, spec: { ...animation.spec, length: data.SequenceLength,
    rate: segment.AnimPlayRate, blendIn: data.BlendIn?.BlendTime ?? .1,
    blendOut: data.BlendOut?.BlendTime ?? .1, additiveDisable: [[0,1,'Linear',0,0]] } };
}
const idle = clip('IdlePose');
const equip = montage('Equip');
const motions = Object.fromEntries([...Array.from({length:7}, (_,i) => ['attack'+(i+1),montage('Attack'+(i+1))]),
  ['heavy',montage('Attack_Alt')], ['inspect',montage('Inspect')]]);
const gunIdle = Buffer.from(Float32Array.from(skeleton.names.flatMap((_,i) =>
  [...skeleton.t.slice(i*3,i*3+3), ...skeleton.q.slice(i*4,i*4+4),1,1,1])).buffer);
const block = (blob, offsets, key) => { const [at,size] = offsets[key]; return [key,blob.subarray(at,at+size)]; };
function write(suffix, manifest, entries) {
  const {bytes, offsets} = pack(entries);
  fs.writeFileSync(path.join(output, stem+suffix+'.json'),JSON.stringify({...manifest,offsets}));
  fs.writeFileSync(path.join(output, stem+suffix+'.bin'),bytes);
}
execFileSync('pwsh', ['-NoProfile','-File',path.join(root,'scripts/build-kuronami-textures.ps1'),'-XenohunterExport',source],{stdio:'inherit'});
write('', {
  toViewQuat:base.toViewQuat,camera:base.camera,attach:base.attach,
  gun:{...gun.meta,skeleton,texture:stem+'-color.png'},arms:base.arms,
  skin:{id:stem,name:'Xenohunter Knife',viewEnvironment:'studio-steel-v1'},
  skinMaterials:[{baseColorTexture:true,normalTexture:true,normalScale:1,baseColorFactor:[1,1,1,1],
    roughness:1,metalness:1,emissiveFactor:[0,0,0],alphaMode:'OPAQUE',doubleSided:false,envMapIntensity:1.15,
    materialMaps:{map:stem+'-color.png',normalMap:stem+'-normal.png',aoMap:stem+'-orm.png',roughnessMap:stem+'-orm.png',metalnessMap:stem+'-orm.png'}}],
  anims:{armsIdle:idle.spec,armsFire:motions.attack1.spec,armsWalk:base.anims.armsWalk,
    gunIdle:{format:'trs32',frames:1,duration:1,bones:[0,1,2],hold:[]}}
},[['gun.mesh',gun.blob],['gunIdle.anim',gunIdle],['armsIdle.anim',idle.bytes],['armsFire.anim',motions.attack1.bytes],
  ...['arms.mesh','armsWalk.anim'].map(key=>block(baseBytes,base.offsets,key))]);
write('.equip',{readySeconds:.6,arms:equip.spec},[['arms.anim',equip.bytes]]);
write('.motions',{additives:locomotion.additives,attachBone:base.attach.bone,tScale:locomotion.tScale,qScale:locomotion.qScale,
  timing:{...locomotion.timing,comboNumber:7},montages:Object.fromEntries(Object.entries(motions).map(([name,a])=>[name,a.spec]))},
  [...Object.entries(motions).map(([name,a])=>[name+'.anim',a.bytes]),
    ...Object.keys(locomotion.additives).flatMap(name=>[name+'.anim',name+'.hold']).map(key=>block(locoBytes,locomotion.offsets,key))]);
console.log(JSON.stringify({vertices:gun.meta.verts,bones:skeleton.names,equip:equip.spec.duration,inspect:motions.inspect.spec.duration,attacks:7}));
