import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial } from '/studio/vendor/three.module.js';
import { championsMaterial } from './champions-materials.mjs';

export function createKarambitAura(gun, blob, offset, spec) {
  const geometry = new BufferGeometry();
  const width = spec.verts * 3;
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(blob, offset, width), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(blob, offset + width * 4, width), 3));
  geometry.setIndex(new BufferAttribute(new Uint16Array(blob, offset + width * 8, spec.indices), 1));

  // A thin emissive edge and two wider, softer shells give the outline a glow
  // in the viewmodel pass without requiring scene-wide bloom.
  const shells = [[3.6, .12], [2.2, .23], [1, .84]].map(([widthScale, opacity]) => {
    const material = new MeshBasicMaterial();
    material.color.setRGB(...spec.color);
    championsMaterial(material, { championsOutline: {
      near: spec.near * widthScale, far: spec.far * widthScale, distance: spec.distance, opacity
    } });
    const shell = new Mesh(geometry, material);
    shell.name = 'champions-karambit:aura';
    shell.frustumCulled = false;
    gun.add(shell);
    return shell;
  });
  return {
    dispose() {
      for (const shell of shells) {
        shell.removeFromParent();
        shell.material.dispose();
      }
      geometry.dispose();
    }
  };
}
