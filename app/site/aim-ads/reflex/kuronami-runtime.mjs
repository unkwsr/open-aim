import {a$ as Color, d6 as MeshStandardMaterial, cN as Texture} from '/_assets/r20261021-1/next/js/BiMsX6Xn.js';
import {DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry} from '/studio/vendor/three.module.js';
import {createReflexDevice, loadReflex} from './device-runtime.mjs';

const assetRoot = '/aim-viewmodel/kuronami-reflex';
const cache = new Map();
let geometry;

async function asset(suffix) {
  const response = await fetch(assetRoot + suffix);
  if (!response.ok) throw new Error(response.url);
  return response;
}

async function bitmap(suffix) {
  const response = await asset(suffix);
  return createImageBitmap(await response.blob(), {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
}

export function loadKuronamiReflex(stem, variant) {
  if (!cache.has(variant)) {
    geometry ??= Promise.all([
      asset('.json').then(response => response.json()),
      asset('.mesh.bin').then(response => response.arrayBuffer()),
      bitmap('-reticle.png'),
    ]);
    const maps = ['color', 'normal', 'orm'].map(name => bitmap('-' + variant + '-' + name + '.png'));
    cache.set(variant, Promise.all([geometry, ...maps]).then(([[data, bin, reticle], bitmap, normal, orm]) => {
      if (!data.kuronamiReflex || data.identity !== 'Kuronami Vandal' || !data.variants[variant]) {
        throw new Error('Invalid Kuronami sight manifest');
      }
      return {data, bin, bitmap, normal, orm, reticle, variant};
    }).catch(error => {
      console.warn('Kuronami sight unavailable', error);
      return null;
    }));
  }
  return cache.get(variant).then(result => result ?? loadReflex(stem));
}

function texture(bitmap, colorSpace = '') {
  const map = new Texture(bitmap);
  map.colorSpace = colorSpace;
  map.flipY = false;
  map.anisotropy = 8;
  map.needsUpdate = true;
  return map;
}

export function createKuronamiReflex(pack, environment, wrap) {
  const variant = pack.data.variants[pack.variant];
  const map = texture(pack.bitmap, 'srgb');
  const normal = texture(pack.normal);
  const orm = texture(pack.orm);
  const body = wrap(new MeshStandardMaterial({
    name: 'kuronami-reflex:body', map, normalMap: normal, aoMap: orm,
    roughnessMap: orm, metalnessMap: orm, metalness: 1, envMap: environment,
  }));
  const lens = wrap(new MeshStandardMaterial({
    name: 'kuronami-reflex:lens', color: new Color().setRGB(...variant.lensColor),
    map, normalMap: normal, roughness: .35, metalness: .1, envMap: environment,
  }));
  const device = createReflexDevice(pack, {body, lens});
  device.mesh.name = 'gun:kuronami-reflex';

  const mask = texture(pack.reticle);
  mask.repeat.y = -1;
  mask.offset.y = 1;
  const reticleGeometry = new PlaneGeometry(pack.data.reticle.width, pack.data.reticle.height);
  const reticleMaterial = new MeshBasicMaterial({
    alphaMap: mask, color: new Color().setRGB(...variant.reticleColor), transparent: true,
    depthWrite: false, side: DoubleSide, toneMapped: false,
  });
  const reticle = new Mesh(reticleGeometry, reticleMaterial);
  reticle.name = 'kuronami-reflex:reticle';
  reticle.position.y = pack.data.reticle.offsetY;
  reticle.visible = false;
  device.bone('Lens').add(reticle);

  const closedPose = device.bones.map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()]);
  let previousOpen = false;
  device.pose = (open, _openAt, _closeAt, _time, enabled = true) => {
    const opened = open && enabled;
    if (opened === previousOpen) return;
    previousOpen = opened;
    reticle.visible = opened;
    const pose = opened ? pack.data.openPose : closedPose;
    device.bones.forEach((bone, index) => {
      bone.position.fromArray(pose[index]);
      bone.quaternion.fromArray(pose[index], 3);
    });
  };
  const dispose = device.dispose;
  device.dispose = () => {
    dispose();
    for (const resource of [body, lens, map, normal, orm, mask, reticleGeometry, reticleMaterial]) resource.dispose();
  };
  return device;
}
