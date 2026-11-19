import { Matrix3, Matrix4, Vector3 } from '/studio/vendor/three.module.js';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

const primordium = { forward: 0, up: 1.9, equipStart: .93, equipContact: 1 };
const kuronami = { forward: .8, up: 2.2, equipStart: .90, equipContact: .95 };
const gaia = { forward: .4, up: 1.9, equipStart: .93, equipContact: 1 };
const rgx = { forward: .35, side: -.95, up: 1.8, equipStart: .93, equipContact: 1 };
const champions = { forward: .35, side: -.70, up: 1.65, equipStart: .93, equipContact: 1 };

export function createSupportGrip(attachment, rig, appearanceRig, skin, kuronamiMotion) {
  const fit = kuronamiMotion ? kuronami :
    skin?.startsWith('gaia-vandal-') ? gaia :
    skin?.startsWith('rgx-vandal-') ? rgx :
    skin === 'champions-vandal' ? champions :
    skin === 'primordium-vandal' || skin === 'primordium-vandal-cobalt' ? primordium : null;
  if (!fit) return null;

  const clavicle = rig.bones[rig.index.get('L_Clavicle')];
  const appearanceClavicle = appearanceRig?.bones[appearanceRig.index.get('L_Clavicle')];
  const arms = [...new Set([clavicle, appearanceClavicle])].filter(bone => bone?.parent)
    .map(bone => ({ bone, offset: new Vector3() }));
  const parentFromGun = new Matrix4(), direction = new Matrix3();

  function reset() {
    for (const { bone, offset } of arms) {
      bone.position.sub(offset);
      offset.set(0, 0, 0);
    }
  }

  function apply({ zoom, equipAge, reloadAge, reloadDuration, inspectWeight }) {
    const equip = equipAge === null ? 1 : smooth((equipAge - fit.equipStart) / (fit.equipContact - fit.equipStart));
    const reload = reloadAge === null ? 1 :
      1 - smooth(reloadAge / .14) * smooth((reloadDuration - reloadAge) / .14);
    const weight = equip * reload * (1 - smooth(inspectWeight));
    if (weight <= 0) return;

    attachment.updateWorldMatrix(true, false);
    for (const { bone, offset } of arms) {
      bone.parent.updateWorldMatrix(true, false);
      parentFromGun.copy(bone.parent.matrixWorld).invert().multiply(attachment.matrixWorld);
      // The mount's local axes are forward, sideways, and up in model centimeters.
      // ADS also lowers the wrist relative to the world-model foregrip.
      offset.set(fit.forward, fit.side ?? 0, fit.up + 1.25 * zoom)
        .applyMatrix3(direction.setFromMatrix4(parentFromGun)).multiplyScalar(weight);
      bone.position.add(offset);
    }
  }

  return { reset, apply };
}
