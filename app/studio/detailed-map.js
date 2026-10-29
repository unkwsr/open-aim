// The real game map (textures and baked lighting) for the Studio's Detailed view.
// The game builds the map with its own three.js copy; the Studio draws with another one, so
// each map mesh is rewrapped in a Studio mesh that shares the game's geometry and material.
// That keeps one renderer, so bots and handles hide behind walls like everything else.
import * as THREE from "./vendor/three.module.js";

const GAME_MAPS = "/_assets/r20261021-1/next/js/BiMsX6Xn.js";
const cache = new Map(); // map id -> Promise<Group>
const OUTSIDE = 0.9; // pieces with this much of their footprint outside the map are backdrop

// Backdrop (distant towers, skyline) stands outside the minimap's map area. The game merges
// meshes by material, so backdrop can share a mesh with the map: those are cut per triangle.
const box = new THREE.Box3(), tint = new THREE.Color(), one = new THREE.Matrix4(), p = new THREE.Vector3();
const outside = (mask, b) => mask && mask.outsideShare(b.min.x, b.min.z, b.max.x, b.max.z) >= OUTSIDE;

// Work is cut into slices so the page keeps drawing frames (and the loading spinner) between them.
const SLICE = 8; // ms of work before giving the page a frame
let sliceStart = 0;
async function breathe() {
  if (performance.now() - sliceStart < SLICE) return;
  await new Promise((r) => setTimeout(r));
  sliceStart = performance.now();
}

// The geometry without triangles far outside the map; the same geometry when nothing goes.
async function trimmed(geometry, matrix, mask) {
  const pos = geometry.attributes.position, index = geometry.index;
  const total = index ? index.count : pos.count;
  const vertex = (i) => (index ? index.getX(i) : i);
  const keep = (i) => {
    const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
    p.set((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3).applyMatrix4(matrix);
    return !mask.far(p.x, p.z);
  };
  const ranges = geometry.groups.length ? geometry.groups : [{ start: 0, count: total, materialIndex: 0 }];
  const kept = [], groups = [];
  for (const g of ranges) {
    const start = kept.length;
    for (let i = g.start; i + 2 < g.start + g.count; i += 3) {
      if (keep(i)) kept.push(vertex(i), vertex(i + 1), vertex(i + 2));
      if (i % 6000 === 0) await breathe();
    }
    groups.push({ start, count: kept.length - start, materialIndex: g.materialIndex });
  }
  if (kept.length === total) return geometry;
  if (!kept.length) return null;
  const out = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) out.setAttribute(name, attribute);
  out.setIndex(new THREE.BufferAttribute(pos.count > 65535 ? new Uint32Array(kept) : new Uint16Array(kept), 1));
  if (geometry.groups.length) for (const g of groups) out.addGroup(g.start, g.count, g.materialIndex);
  out.computeBoundingSphere();
  return out;
}

async function rewrap(source, mask) {
  source.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.name = "detailed-map";
  group.matrixAutoUpdate = false;
  const meshes = [];
  source.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
  sliceStart = performance.now();
  for (const o of meshes) {
    await breathe();
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    let geometry = o.geometry;
    if (!o.isInstancedMesh && mask) {
      if (outside(mask, box.copy(geometry.boundingBox).applyMatrix4(o.matrixWorld))) continue;
      geometry = await trimmed(geometry, o.matrixWorld, mask);
      if (!geometry) continue;
    }
    const mesh = o.isInstancedMesh ? new THREE.InstancedMesh(geometry, o.material, o.count) : new THREE.Mesh(geometry, o.material);
    if (o.isInstancedMesh) {
      // Keep only the copies inside the map; the game's own buffers stay untouched.
      const keep = [];
      for (let i = 0; i < o.count; i++) {
        one.fromArray(o.instanceMatrix.array, i * 16).premultiply(o.matrixWorld);
        box.copy(o.geometry.boundingBox).applyMatrix4(one);
        if (!mask || (!outside(mask, box) && !mask.far((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2))) keep.push(i);
      }
      if (!keep.length) continue;
      if (keep.length === o.count) {
        mesh.instanceMatrix = o.instanceMatrix;
        if (o.instanceColor) mesh.instanceColor = o.instanceColor;
      } else {
        mesh.count = keep.length;
        keep.forEach((i, n) => {
          one.fromArray(o.instanceMatrix.array, i * 16);
          mesh.setMatrixAt(n, one);
          if (o.instanceColor) mesh.setColorAt(n, tint.fromArray(o.instanceColor.array, i * 3));
        });
      }
      mesh.computeBoundingSphere();
    }
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(o.matrixWorld);
    mesh.matrixWorld.copy(o.matrixWorld);
    mesh.frustumCulled = o.frustumCulled;
    mesh.renderOrder = o.renderOrder;
    mesh.raycast = () => {}; // picking uses the light floor mesh, not a million triangles
    group.add(mesh);
  }
  return group;
}

// map: the Studio map from map-data.js (its id and playable-area mask).
export function loadDetailedMap(map) {
  let entry = cache.get(map.id);
  if (!entry) {
    entry = import(GAME_MAPS).then((game) => game.l(map.id)).then((source) => rewrap(source, map.mask));
    entry.catch(() => cache.delete(map.id));
    cache.set(map.id, entry);
  }
  return entry;
}
